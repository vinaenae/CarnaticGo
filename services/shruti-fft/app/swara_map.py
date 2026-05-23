"""Map Hz → nearest swara token (training chart) for a rāga's allowed notes."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "raga_swara_notes.json"


@dataclass(frozen=True)
class SwaraHit:
    token: str
    hz: float
    cents_off: float
    in_raga: bool


def _load_data() -> dict:
    with DATA_PATH.open(encoding="utf-8") as f:
        return json.load(f)


_DATA: dict | None = None


def get_catalog() -> dict:
    global _DATA
    if _DATA is None:
        _DATA = _load_data()
    return _DATA


def list_ragas() -> list[dict]:
    return get_catalog().get("ragas", [])


def swaras_for_raga(raga_id: str | None) -> list[dict]:
    if not raga_id:
        chart = get_catalog().get("chartHz", {})
        return [{"token": k, "hz": v} for k, v in sorted(chart.items(), key=lambda x: x[1])]
    for r in list_ragas():
        if r["id"] == raga_id:
            return r["swaras"]
    return []


def nearest_swara(hz: float, allowed: list[dict], cents_limit: float = 75.0) -> SwaraHit | None:
    import math

    if not allowed or hz <= 0:
        return None
    best = None
    best_cents = 1e9
    for entry in allowed:
        ref = float(entry["hz"])
        if ref <= 0:
            continue
        cents = 1200.0 * math.log2(hz / ref)
        ac = abs(cents)
        if ac < best_cents:
            best_cents = ac
            best = (entry["token"], ref, cents)
    if best is None or best_cents > cents_limit:
        return None
    token, ref_hz, cents = best
    return SwaraHit(token=token, hz=ref_hz, cents_off=cents, in_raga=True)


def fold_to_chart_octave(hz: float, sa_hz: float = 240.0) -> float:
    """Fold detected Hz into one octave above Sa (chart uses fixed absolute Hz)."""
    import math

    if hz <= 0 or sa_hz <= 0:
        return hz
    ratio = hz / sa_hz
    if ratio <= 0:
        return hz
    octaves = round(math.log2(ratio))
    folded = hz / (2.0**octaves)
    while folded < sa_hz * 0.92:
        folded *= 2.0
    while folded > sa_hz * 1.92:
        folded /= 2.0
    return folded
