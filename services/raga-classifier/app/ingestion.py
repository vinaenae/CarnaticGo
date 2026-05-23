"""Decode uploaded audio to mono 16 kHz waveform."""

from __future__ import annotations

import io

import librosa
import numpy as np

TARGET_SR = 16000


def load_audio_bytes(data: bytes, *, target_sr: int = TARGET_SR) -> np.ndarray:
    if len(data) < 256:
        raise ValueError("audio_too_short")
    try:
        y, _ = librosa.load(io.BytesIO(data), sr=target_sr, mono=True)
    except Exception as e:
        raise ValueError(f"audio_decode_failed:{e!s}") from e
    return y.astype(np.float32)
