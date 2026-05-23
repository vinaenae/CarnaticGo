#!/usr/bin/env python3
"""
Live microphone swara detector (FFT) — runs on your laptop without the browser.

  cd services/shruti-fft
  python -m venv .venv
  .venv\\Scripts\\activate   # Windows
  pip install -r requirements.txt
  node ../../scripts/generate-raga-swara-notes.mjs   # once, from repo root
  python scripts/live_mic.py
  python scripts/live_mic.py --raga Mohanam
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.fft_pitch import estimate_pitch_hz  # noqa: E402
from app.swara_map import fold_to_chart_octave, list_ragas, nearest_swara, swaras_for_raga  # noqa: E402

try:
    import sounddevice as sd
except ImportError:
    print("Install sounddevice: pip install sounddevice", file=sys.stderr)
    raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Live FFT swara detection from mic")
    parser.add_argument("--raga", default=None, help="Raga id from scale quiz (e.g. Mohanam)")
    parser.add_argument("--device", type=int, default=None, help="sounddevice input index")
    parser.add_argument("--block-ms", type=int, default=120, help="Analysis block size in ms")
    args = parser.parse_args()

    sr = 44100
    block = max(512, int(sr * args.block_ms / 1000))
    allowed = swaras_for_raga(args.raga)
    if args.raga and not allowed:
        print(f"Unknown raga '{args.raga}'. Options:", ", ".join(r["id"] for r in list_ragas()[:20]), "…")
        sys.exit(1)

    label = args.raga or "full chart"
    print(f"Listening on device {args.device!r} @ {sr} Hz — raga filter: {label}")
    print("Allowed swaras:", ", ".join(s["token"] for s in allowed))
    print("Ctrl+C to quit.\n")

    last_print = 0.0

    def callback(indata, _frames, _time, status) -> None:
        nonlocal last_print
        if status:
            print(status, file=sys.stderr)
        mono = indata[:, 0] if indata.ndim > 1 else indata.flatten()
        hz, conf = estimate_pitch_hz(mono, float(sr))
        now = time.time()
        if now - last_print < 0.12:
            return
        last_print = now
        if hz is None:
            print("\r— (no pitch)     ", end="", flush=True)
            return
        folded = fold_to_chart_octave(hz)
        hit = nearest_swara(folded, allowed)
        if hit:
            direction = "sharp" if hit.cents_off > 0 else "flat"
            print(
                f"\r{hit.token:4}  {hz:6.1f} Hz  ({abs(hit.cents_off):4.0f}¢ {direction})  conf {conf:.2f}   ",
                end="",
                flush=True,
            )
        else:
            print(f"\r?     {hz:6.1f} Hz (off chart)  conf {conf:.2f}   ", end="", flush=True)

    with sd.InputStream(
        samplerate=sr,
        blocksize=block,
        device=args.device,
        channels=1,
        dtype="float32",
        callback=callback,
    ):
        while True:
            time.sleep(0.25)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
