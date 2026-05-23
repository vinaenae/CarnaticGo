"""
Raga classification — sarayusapa/sam-carnatic

Default (readme): Hugging Face model card + preprocessor_config.json
  - model.safetensors (raga path weights)
  - librosa 16 kHz mono
  - pad/truncate to max_length 320000
  - model(input_audio=waveform) → softmax

Set RAGA_INFERENCE_MODE=dual_path for inference/inference.py (shruti + normalize).
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any, Literal

import numpy as np
import torch
import torch.nn.functional as F
from safetensors.torch import load_file

from app.hf_assets import asset_path, load_json_asset
from app.ingestion import TARGET_SR, load_audio_bytes
from app.model import SAMAudioModel, ShrutiDetectionHead

SAMPLE_RATE = TARGET_SR
CHUNK_SAMPLES = 320_000
TARGET_SA_HZ = 261.63
InferenceMode = Literal["readme", "dual_path"]

_model: SAMAudioModel | None = None
_config: dict[str, Any] | None = None
_preprocessor: dict[str, Any] | None = None
_device: torch.device | None = None
_weights_source: str | None = None


def _inference_mode() -> InferenceMode:
    mode = os.getenv("RAGA_INFERENCE_MODE", "readme").strip().lower()
    if mode in ("dual", "dual_path", "full"):
        return "dual_path"
    return "readme"


def _select_device() -> torch.device:
    pref = os.getenv("RAGA_CLASSIFIER_DEVICE", "auto").lower()
    if pref == "cpu":
        return torch.device("cpu")
    if pref == "cuda" and torch.cuda.is_available():
        return torch.device("cuda")
    if pref == "mps" and torch.backends.mps.is_available():
        return torch.device("mps")
    if pref == "auto":
        if torch.cuda.is_available():
            return torch.device("cuda")
        if torch.backends.mps.is_available():
            return torch.device("mps")
    return torch.device("cpu")


def _apply_preprocessor(waveform: np.ndarray, preprocessor: dict[str, Any], *, mode: InferenceMode) -> np.ndarray:
    """
    readme: HF model card — truncate to max_length, no zero-pad on short clips.
    dual_path: 20 s chunks are zero-padded in chunk_audio().
    """
    max_len = int(preprocessor.get("max_length", CHUNK_SAMPLES))
    y = waveform.astype(np.float32)
    if len(y) > max_len:
        y = y[:max_len]
    elif mode != "readme" and len(y) < max_len:
        padded = np.zeros(max_len, dtype=np.float32)
        padded[: len(y)] = y
        y = padded
    if preprocessor.get("normalize", True):
        peak = float(np.max(np.abs(y)))
        if peak > 1e-8:
            y = y / peak
    return y


def pitch_shift_waveform(waveform: torch.Tensor, shift_semitones: float) -> torch.Tensor:
    if shift_semitones == 0:
        return waveform
    rate = 2.0 ** (-shift_semitones / 12.0)
    indices = torch.arange(0, waveform.shape[0] * rate, rate, device=waveform.device)
    indices = indices.long().clamp(max=waveform.shape[0] - 1)
    shifted = waveform[indices]
    orig_len = waveform.shape[0]
    if shifted.shape[0] > orig_len:
        shifted = shifted[:orig_len]
    elif shifted.shape[0] < orig_len:
        shifted = F.pad(shifted, (0, orig_len - shifted.shape[0]))
    return shifted


def chunk_audio(waveform: np.ndarray) -> list[np.ndarray]:
    if len(waveform) <= CHUNK_SAMPLES:
        padded = np.zeros(CHUNK_SAMPLES, dtype=np.float32)
        padded[: len(waveform)] = waveform
        return [padded]
    chunks: list[np.ndarray] = []
    for start in range(0, len(waveform), CHUNK_SAMPLES):
        chunk = waveform[start : start + CHUNK_SAMPLES]
        if len(chunk) < CHUNK_SAMPLES:
            padded = np.zeros(CHUNK_SAMPLES, dtype=np.float32)
            padded[: len(chunk)] = chunk
            chunk = padded
        chunks.append(chunk)
    return chunks


def _load_readme_weights(model: SAMAudioModel, device: torch.device) -> str:
    """
    HF card: load_file('model.safetensors') then load_state_dict.
    That file has raga-path weights only (no shruti_detector) — strict=False.
    Fallback: best_model.pth full checkpoint.
    """
    st_path = asset_path("model.safetensors")
    try:
        state_dict = load_file(st_path, device=str(device))
        missing, unexpected = model.load_state_dict(state_dict, strict=False)
        if missing:
            shruti_only = all("shruti_detector" in k for k in missing)
            if not shruti_only:
                raise RuntimeError(f"safetensors missing non-shruti keys: {missing[:5]}")
        return f"model.safetensors ({Path(st_path).name})"
    except Exception as e:
        print(f"[raga-classifier] safetensors load failed ({e}), using best_model.pth")

    pth_path = asset_path("best_model.pth")
    ckpt = torch.load(pth_path, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"], strict=True)
    return f"best_model.pth ({Path(pth_path).name})"


def _load_dual_weights(model: SAMAudioModel, device: torch.device) -> str:
    pth_path = asset_path("best_model.pth")
    ckpt = torch.load(pth_path, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"], strict=True)
    return f"best_model.pth ({Path(pth_path).name})"


def ensure_model_loaded() -> tuple[SAMAudioModel, dict[str, Any], dict[str, Any], torch.device]:
    global _model, _config, _preprocessor, _device, _weights_source
    if _model is not None and _config is not None and _preprocessor is not None and _device is not None:
        return _model, _config, _preprocessor, _device

    device = _select_device()
    mode = _inference_mode()
    config = load_json_asset("config.json")
    preprocessor = load_json_asset("preprocessor_config.json")

    model = SAMAudioModel(
        encoder_config=config["encoder"],
        num_classes=config["num_classes"],
        num_segments=config["num_segments"],
        contrastive_temperature=config.get("contrastive_temperature", 0.07),
    )

    _weights_source = _load_dual_weights(model, device) if mode == "dual_path" else _load_readme_weights(model, device)
    model.to(device).eval()

    _model = model
    _config = config
    _preprocessor = preprocessor
    _device = device
    return model, config, preprocessor, device


@torch.no_grad()
def _predict_readme_card(
    model: SAMAudioModel,
    waveform: np.ndarray,
    preprocessor: dict[str, Any],
    device: torch.device,
) -> torch.Tensor:
    """HF README + preprocessor_config max_length / normalize."""
    y = _apply_preprocessor(waveform, preprocessor, mode="readme")
    tensor = torch.from_numpy(y).float().unsqueeze(0).to(device)
    out = model(input_audio=tensor)
    return torch.softmax(out["raga_logits"], dim=-1).squeeze(0)


@torch.no_grad()
def detect_shruti(model: SAMAudioModel, waveform: np.ndarray, device: torch.device) -> float:
    all_semitones: list[torch.Tensor] = []
    for chunk in chunk_audio(waveform):
        tensor = torch.from_numpy(chunk).float().unsqueeze(0).to(device)
        out = model(input_audio=None, input_audio_original=tensor)
        all_semitones.append(out["predicted_shruti_semitones"])
    avg_semitones = torch.stack(all_semitones).mean().item()
    return ShrutiDetectionHead.semitones_to_hz(torch.tensor(avg_semitones)).item()


@torch.no_grad()
def _predict_dual_path(
    model: SAMAudioModel,
    waveform: np.ndarray,
    detected_sa_hz: float,
    device: torch.device,
) -> torch.Tensor:
    normalize_semitones = 12.0 * math.log2(TARGET_SA_HZ / detected_sa_hz)
    waveform_tensor = torch.from_numpy(waveform).float()
    normalized = pitch_shift_waveform(waveform_tensor, normalize_semitones).numpy()
    all_probs: list[torch.Tensor] = []
    for chunk in chunk_audio(normalized):
        tensor = torch.from_numpy(chunk).float().unsqueeze(0).to(device)
        out = model(input_audio=tensor)
        all_probs.append(torch.softmax(out["raga_logits"], dim=-1))
    return torch.stack(all_probs).mean(dim=0).squeeze(0)


def _build_response(
    *,
    probs: torch.Tensor,
    id2label: dict[str, str],
    duration_s: float,
    input_peak: float,
    input_rms: float,
    detected_sa: float | None,
    mode: InferenceMode,
    weights_source: str,
) -> dict[str, Any]:
    sorted_idx = probs.argsort(descending=True)
    predictions = [
        {"raga": id2label[str(int(sorted_idx[i].item()))], "confidence": float(probs[sorted_idx[i]].item())}
        for i in range(min(8, len(id2label)))
    ]
    best = predictions[0]
    return {
        "predictedRaga": best["raga"],
        "confidence": best["confidence"],
        "detectedSaHz": round(detected_sa, 2) if detected_sa is not None else None,
        "durationSeconds": round(duration_s, 2),
        "inputPeak": round(input_peak, 4),
        "inputRms": round(input_rms, 4),
        "predictions": predictions,
        "modelId": os.getenv("SAM_CARNATIC_REPO", "sarayusapa/sam-carnatic"),
        "pipeline": "readme_card" if mode == "readme" else "dual_path_v1",
        "inferenceMode": "local_pytorch",
        "huggingFaceInferenceApi": False,
        "weightsSource": weights_source,
    }


def classify_raga_from_bytes(data: bytes) -> dict[str, Any]:
    model, config, preprocessor, device = ensure_model_loaded()
    id2label: dict[str, str] = config["id2label"]
    mode = _inference_mode()

    waveform = load_audio_bytes(data)
    duration_s = len(waveform) / SAMPLE_RATE
    if duration_s < 2.0:
        raise ValueError("audio_too_short_min_2s")

    input_peak = float(np.max(np.abs(waveform)))
    input_rms = float(np.sqrt(np.mean(waveform**2)))
    if input_peak < 0.002:
        raise ValueError("audio_too_quiet")

    weights_source = _weights_source or "unknown"

    if mode == "readme":
        probs = _predict_readme_card(model, waveform, preprocessor, device)
        return _build_response(
            probs=probs,
            id2label=id2label,
            duration_s=duration_s,
            input_peak=input_peak,
            input_rms=input_rms,
            detected_sa=None,
            mode=mode,
            weights_source=weights_source,
        )

    detected_sa = detect_shruti(model, waveform, device)
    probs = _predict_dual_path(model, waveform, detected_sa, device)
    return _build_response(
        probs=probs,
        id2label=id2label,
        duration_s=duration_s,
        input_peak=input_peak,
        input_rms=input_rms,
        detected_sa=detected_sa,
        mode=mode,
        weights_source=weights_source,
    )
