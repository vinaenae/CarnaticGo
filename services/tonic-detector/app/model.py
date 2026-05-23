"""KritiSamhita tonic CNN — must match Colab / train_tonic.py."""

from __future__ import annotations

import io
import json
from pathlib import Path

import librosa
import numpy as np
import torch
import torch.nn as nn

_ROOT = Path(__file__).resolve().parents[1]

TONICS = ["F#", "G", "G#", "A"]
KATTAI = {"F#": "4.5", "G": "5", "G#": "5.5", "A": "6"}
KATTAI_KEYS = {
    "F#": "kattai_4_5",
    "G": "kattai_5",
    "G#": "kattai_5_5",
    "A": "kattai_6",
}

SR = 22050
N_MELS = 128
CLIP_SECONDS = 20.0
MEL_FRAMES = int(CLIP_SECONDS * SR / 512)

_model: "SmallTonicCNN | None" = None
_device: torch.device | None = None
_meta: dict | None = None


class SmallTonicCNN(nn.Module):
    def __init__(self, n_classes: int = 4):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((4, 4)),
            nn.Flatten(),
            nn.Linear(64 * 4 * 4, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, n_classes),
        )

    def forward(self, x):
        return self.net(x)


def _checkpoint_dir() -> Path:
    import os

    custom = os.getenv("TONIC_CHECKPOINT_DIR", "").strip()
    if custom:
        return Path(custom)
    return _ROOT / "checkpoints"


def _mel_tensor(y: np.ndarray, sr: int, n_mels: int, mel_frames: int) -> torch.Tensor:
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=n_mels)
    mel_db = librosa.power_to_db(mel, ref=np.max)
    if mel_db.shape[1] < mel_frames:
        mel_db = np.pad(mel_db, ((0, 0), (0, mel_frames - mel_db.shape[1])), mode="constant")
    else:
        mel_db = mel_db[:, :mel_frames]
    return torch.tensor(mel_db, dtype=torch.float32).unsqueeze(0).unsqueeze(0)


def ensure_model_loaded() -> tuple[SmallTonicCNN, torch.device, dict]:
    global _model, _device, _meta
    if _model is not None and _device is not None and _meta is not None:
        return _model, _device, _meta

    ckpt_dir = _checkpoint_dir()
    ckpt_path = ckpt_dir / "tonic_cnn.pt"
    if not ckpt_path.is_file():
        raise FileNotFoundError(f"Missing {ckpt_path}. Train in Colab and copy checkpoints.")

    map_path = ckpt_dir / "label_map.json"
    meta = json.loads(map_path.read_text(encoding="utf-8")) if map_path.is_file() else {}

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)

    sr = int(ckpt.get("sr", meta.get("sr", SR)))
    n_mels = int(ckpt.get("n_mels", meta.get("n_mels", N_MELS)))
    mel_frames = int(ckpt.get("mel_frames", meta.get("mel_frames", MEL_FRAMES)))
    tonics = ckpt.get("tonics", meta.get("tonics", TONICS))

    model = SmallTonicCNN(n_classes=len(tonics))
    model.load_state_dict(ckpt["state_dict"])
    model.to(device)
    model.eval()

    _model = model
    _device = device
    _meta = {
        "tonics": list(tonics),
        "kattai": ckpt.get("kattai", meta.get("kattai", KATTAI)),
        "sr": sr,
        "n_mels": n_mels,
        "mel_frames": mel_frames,
    }
    return _model, _device, _meta


def predict_tonic_from_bytes(raw: bytes, filename: str = "audio.wav") -> dict:
    model, device, meta = ensure_model_loaded()
    sr = meta["sr"]
    n_mels = meta["n_mels"]
    mel_frames = meta["mel_frames"]
    tonics: list[str] = meta["tonics"]
    kattai_map: dict = meta["kattai"]

    y, _ = librosa.load(io.BytesIO(raw), sr=sr, mono=True)
    x = _mel_tensor(y, sr, n_mels, mel_frames).to(device)

    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    idx = int(probs.argmax())
    tonic = tonics[idx]
    return {
        "tonic": tonic,
        "kattai": str(kattai_map.get(tonic, KATTAI.get(tonic, ""))),
        "kattaiKey": KATTAI_KEYS.get(tonic, "kattai_5"),
        "confidence": float(probs[idx]),
        "probabilities": {tonics[i]: float(probs[i]) for i in range(len(tonics))},
        "source": "kriti-samhita-cnn",
    }
