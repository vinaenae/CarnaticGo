"""
Quiz / arohanam–avarohanam raga classification — jeevster/carnatic-raga-classifier.

ResNet on 8 kHz stereo, 30 s windows, 150 raga classes.
@see https://huggingface.co/spaces/jeevster/carnatic-raga-classifier
"""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path
from typing import Any, Literal

import librosa
import numpy as np
import torch

ClassificationMode = Literal["performance", "quiz"]

_VENDOR = Path(__file__).resolve().parents[1] / "vendor" / "jeevster"  # contains inference.py, models/, data/, utils/
_DEFAULT_WEIGHTS = Path(__file__).resolve().parents[1] / "weights" / "jeevster"

_evaluator: Any | None = None

def weights_dir() -> Path:
    raw = os.getenv("JEEVSTER_WEIGHTS_DIR", "").strip()
    if raw:
        p = Path(raw)
        if p.is_dir():
            return p
    if _DEFAULT_WEIGHTS.is_dir():
        return _DEFAULT_WEIGHTS
    raise FileNotFoundError(
        "jeevster weights not found. Run: python scripts/download_jeevster_weights.py"
    )


def _ensure_vendor_path() -> None:
    root = str(_VENDOR)
    if root not in sys.path:
        sys.path.insert(0, root)


def _model_label(name: str) -> str:
    """Return classifier label as-is (150-class jeevster vocabulary)."""
    return name


def ensure_jeevster_loaded() -> Any:
    global _evaluator
    if _evaluator is not None:
        return _evaluator

    _ensure_vendor_path()
    wdir = weights_dir()
    ckpt = wdir / "ckpts/resnet_0.7/150classes_alldata_cliplength30/training_checkpoints/best_ckpt.tar"
    if not ckpt.is_file():
        raise FileNotFoundError(f"Missing checkpoint: {ckpt}")

    from utils.YParams import YParams  # noqa: WPS433 — vendored

    config_path = wdir / "config.yaml"
    params = YParams(str(config_path), "resnet_0.7")
    params.metadata_labeled_path = str(wdir / "labeled_0.7_wav_metadata.json")
    params.num_files_per_raga_path = str(wdir / "metadata_0.7.json")
    exp = "ckpts/resnet_0.7/150classes_alldata_cliplength30"
    params["best_checkpoint_path"] = f"{exp}/training_checkpoints/best_ckpt.tar"
    params["checkpoint_path"] = f"{exp}/training_checkpoints/ckpt.tar"
    try:
        params.device = torch.device(torch.cuda.current_device())
    except Exception:
        params.device = torch.device("cpu")

    from inference import Evaluator  # noqa: WPS433 — vendored under vendor/jeevster

    old_cwd = os.getcwd()
    try:
        os.chdir(wdir)
        ev = Evaluator(params)
    finally:
        os.chdir(old_cwd)
    ev.model.eval()
    _evaluator = ev
    return _evaluator


def classify_quiz_from_bytes(data: bytes, *, top_k: int = 8) -> dict[str, Any]:
    if len(data) < 256:
        raise ValueError("audio_too_short")

    y, sr = librosa.load(io.BytesIO(data), sr=None, mono=False)
    if y.ndim == 2:
        y = y.mean(axis=0)
    y = np.asarray(y, dtype=np.float32)

    duration_s = len(y) / float(sr)
    if duration_s < 5.0:
        raise ValueError("audio_too_short_min_5s")
    input_peak = float(np.max(np.abs(y)))
    input_rms = float(np.sqrt(np.mean(y**2)))
    if input_peak < 0.002:
        raise ValueError("audio_too_quiet")

    evaluator = ensure_jeevster_loaded()
    # Gradio-style (sample_rate, numpy 1d)
    raw = evaluator.inference(top_k, (int(sr), y))

    items = sorted(raw.items(), key=lambda x: x[1], reverse=True)
    predictions = [
        {"raga": _model_label(name), "confidence": float(prob)}
        for name, prob in items[:top_k]
    ]
    best = predictions[0]
    wdir = weights_dir()

    return {
        "predictedRaga": best["raga"],
        "confidence": best["confidence"],
        "detectedSaHz": None,
        "durationSeconds": round(duration_s, 2),
        "inputPeak": round(input_peak, 4),
        "inputRms": round(input_rms, 4),
        "predictions": predictions,
        "modelId": "jeevster/carnatic-raga-classifier",
        "pipeline": "jeevster_resnet_150",
        "inferenceMode": "local_pytorch",
        "huggingFaceInferenceApi": False,
        "weightsSource": f"best_ckpt.tar ({wdir.name})",
        "classificationMode": "quiz",
        "minRecommendedSeconds": 30,
    }
