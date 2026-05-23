"""Librosa onset strength + peak picking — vocal attacks / phrase starts."""

from __future__ import annotations

import numpy as np
import librosa

from typing import Tuple


def compute_onsets(
    y: np.ndarray,
    sr: int,
    *,
    hop_length: int = 512,
    aggregate_median: bool = True,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Returns (onset_times_sec, onset_strength_envelope).
    onset_times_sec: sorted unique onset times in seconds.
    """
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length, aggregate=np.median if aggregate_median else np.mean)
    onset_frames = librosa.onset.onset_detect(
        y=y,
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop_length,
        backtrack=True,
        units="frames",
    )
    times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length)
    # de-duplicate very close peaks (librosa sometimes doubles)
    if times.size == 0:
        return times.astype(np.float64), onset_env.astype(np.float64)
    merged = [float(times[0])]
    min_gap = 0.03  # 30 ms
    for t in times[1:]:
        t = float(t)
        if t - merged[-1] >= min_gap:
            merged.append(t)
    return np.array(merged, dtype=np.float64), onset_env.astype(np.float64)
