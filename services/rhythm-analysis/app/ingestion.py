"""Load and normalize uploaded audio for analysis."""

from __future__ import annotations

import io
from typing import Tuple

import librosa
import numpy as np


def load_audio_bytes(
    data: bytes,
    *,
    target_sr: int = 22050,
    mono: bool = True,
) -> Tuple[np.ndarray, int]:
    """
    Decode arbitrary format (wav/webm/mp3) via librosa/soundfile stack.
    Returns (y, sr) with y float32 mono, length n.
    """
    y, sr = librosa.load(io.BytesIO(data), sr=target_sr, mono=mono)
    if y.size == 0:
        raise ValueError("empty_audio")
    return y.astype(np.float32), int(sr)
