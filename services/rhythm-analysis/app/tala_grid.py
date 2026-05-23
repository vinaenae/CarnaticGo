"""
Fixed tala reference frame — no automatic tala recognition.

Adi (Chatushra jathi): one avartanam = 8 metronome pulses at the same BPM
as the in-app metronome (each click = one beat / akshara step for this MVP).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

TalaId = Literal["adi"]

# Beats per cycle for supported talas (metronome clicks per avartanam).
TALA_CYCLE_BEATS: dict[TalaId, int] = {
    "adi": 8,
}


@dataclass(frozen=True)
class BeatGridParams:
    bpm: float
    tala: TalaId
    beat_period_sec: float
    cycle_beats: int
    cycle_period_sec: float


def build_grid_params(bpm: float, tala: TalaId = "adi") -> BeatGridParams:
    if bpm <= 0 or bpm > 400:
        raise ValueError("bpm_out_of_range")
    beats = TALA_CYCLE_BEATS[tala]
    beat_period = 60.0 / float(bpm)
    return BeatGridParams(
        bpm=float(bpm),
        tala=tala,
        beat_period_sec=beat_period,
        cycle_beats=beats,
        cycle_period_sec=beat_period * beats,
    )
