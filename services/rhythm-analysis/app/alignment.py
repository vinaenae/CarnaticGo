"""Align detected onsets to a fixed BPM beat grid (Carnatic tala as reference only)."""

from __future__ import annotations

import numpy as np

from app.tala_grid import BeatGridParams


def nearest_pulse_signed_offset_sec(onset_sec: float, beat_period_sec: float, phase_sec: float) -> float:
    """
    Signed (onset_time - nearest_expected_pulse_time) in seconds.
    Positive => onset after the beat (late); negative => early.
    """
    p = beat_period_sec
    ph = phase_sec % p
    k = int(round((onset_sec - ph) / p))
    pulse_time = ph + k * p
    return float(onset_sec - pulse_time)


def best_grid_phase_ms(
    onsets_sec: np.ndarray,
    params: BeatGridParams,
    *,
    grid_steps: int = 48,
) -> tuple[float, np.ndarray]:
    """
    Search phase in [0, beat_period) minimizing mean absolute onset-to-beat error.
    Returns (best_phase_sec, signed_offsets_sec for that phase).
    """
    p = params.beat_period_sec
    if onsets_sec.size == 0 or p <= 0:
        return 0.0, np.array([], dtype=np.float64)

    phases = np.linspace(0.0, p, num=grid_steps, endpoint=False)
    best_phase = 0.0
    best_mae = 1e18
    best_offs = np.zeros_like(onsets_sec)

    for ph in phases:
        offs = np.array(
            [nearest_pulse_signed_offset_sec(float(t), p, float(ph)) for t in onsets_sec],
            dtype=np.float64,
        )
        mae = float(np.mean(np.abs(offs)))
        if mae < best_mae:
            best_mae = mae
            best_phase = float(ph)
            best_offs = offs

    return best_phase, best_offs
