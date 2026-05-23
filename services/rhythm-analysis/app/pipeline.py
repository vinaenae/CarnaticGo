"""Full rhythm pipeline: ingest → onsets → tala grid → alignment → scores."""

from __future__ import annotations

import numpy as np

from app.alignment import best_grid_phase_ms
from app.ingestion import load_audio_bytes
from app.onsets import compute_onsets
from app.scoring import scores_from_offsets
from app.tala_grid import build_grid_params


def analyze_rhythm_segment(
    audio_bytes: bytes,
    *,
    bpm: float,
    tala: str = "adi",
) -> dict:
    """
    Run librosa onset path + fixed Adi/BPM grid alignment.
    Returns a dict suitable for JSON (camelCase keys at HTTP boundary).
    """
    if tala != "adi":
        raise ValueError("unsupported_tala")

    y, sr = load_audio_bytes(audio_bytes)
    duration_sec = float(y.size / sr)

    onsets_sec, onset_env = compute_onsets(y, sr)
    params = build_grid_params(bpm, "adi")

    phase_sec, offsets_sec = best_grid_phase_ms(onsets_sec, params)
    offsets_ms = offsets_sec * 1000.0

    mean_abs, stab, align, conf = scores_from_offsets(
        offsets_ms,
        params.beat_period_sec,
        duration_sec,
        onset_env,
    )

    return {
        "averageTimingOffsetMs": mean_abs,
        "rhythmStabilityScore": stab,
        "beatAlignmentScore": align,
        "detectedOnsets": [float(t) for t in onsets_sec],
        "confidence": conf,
        "beatPeriodSec": params.beat_period_sec,
        "cycleBeats": params.cycle_beats,
        "gridPhaseSec": phase_sec,
    }
