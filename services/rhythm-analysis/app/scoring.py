"""Map raw timing errors to 0–100 scores + confidence (onset pipeline quality)."""

from __future__ import annotations

import numpy as np


def scores_from_offsets(
    offsets_ms: np.ndarray,
    beat_period_sec: float,
    duration_sec: float,
    onset_strength: np.ndarray | None,
) -> tuple[float, float, float, float]:
    """
    Returns (mean_abs_offset_ms, rhythm_stability_0_100, beat_alignment_0_100, confidence_0_1).
    """
    if offsets_ms.size == 0:
        return 0.0, 0.0, 0.0, 0.0

    mean_abs = float(np.mean(np.abs(offsets_ms)))
    std_ms = float(np.std(np.abs(offsets_ms)))

    period_ms = beat_period_sec * 1000.0
    align = 100.0 * max(0.0, 1.0 - (mean_abs / max(period_ms * 0.35, 1.0)))
    align = float(max(0.0, min(100.0, align)))

    stab = 100.0 * max(0.0, 1.0 - (std_ms / max(period_ms * 0.25, 1.0)))
    stab = float(max(0.0, min(100.0, stab)))

    n = int(offsets_ms.size)
    density = min(1.0, n / max(duration_sec * 2.0, 1e-6))

    strength_term = 0.5
    if onset_strength is not None and onset_strength.size > 0:
        sm = float(np.median(onset_strength))
        sx = float(np.percentile(onset_strength, 95) + 1e-9)
        strength_term = float(max(0.0, min(1.0, sm / sx)))

    conf = 0.35 + 0.35 * density + 0.3 * strength_term
    conf = float(max(0.0, min(1.0, conf)))

    return mean_abs, stab, align, conf
