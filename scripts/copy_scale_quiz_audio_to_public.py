#!/usr/bin/env python3
"""Copy data/raga-scales/audio/*.wav to public/assets/scale-quiz-audio/ for the scale quiz."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "raga-scales" / "audio"
DST = ROOT / "public" / "assets" / "scale-quiz-audio"


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    if not SRC.exists():
        print("No source audio — run first:")
        print("  python scripts/build_raga_scales_dataset.py --audio --audio-limit 20")
        return 0
    n = 0
    for f in sorted(SRC.glob("*.wav")):
        shutil.copy2(f, DST / f.name)
        n += 1
    print(f"Copied {n} WAV(s) to {DST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
