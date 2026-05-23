"""How accuracy changes when using only the first N seconds (quiz-length)."""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pyarrow.parquet as pq
import soundfile as sf
from huggingface_hub import hf_hub_download

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from app.pipeline import classify_raga_from_bytes  # noqa: E402


def main() -> None:
    p = hf_hub_download(
        repo_id="sarayusapa/carnatic-ragas",
        repo_type="dataset",
        filename="data/train-00000-of-00005.parquet",
    )
    table = pq.read_table(p)
    seen: set[str] = set()
    for sec in (10, 12, 15, 18, 20):
        print(f"\n--- first {sec}s ---")
        seen.clear()
        for i in range(table.num_rows):
            row = {name: table.column(name)[i].as_py() for name in table.column_names}
            name = str(row["raga"])
            if name in seen:
                continue
            seen.add(name)
            raw = row["audio"]["bytes"]
            import librosa
            import numpy as np

            y, _ = librosa.load(io.BytesIO(raw), sr=16000, mono=True)
            clip = y[: sec * 16000]
            buf = io.BytesIO()
            sf.write(buf, clip, 16000, format="WAV")
            buf.seek(0)
            r = classify_raga_from_bytes(buf.read())
            ok = r["predictedRaga"] == name
            print(f"  {name:20} -> {r['predictedRaga']:20} {r['confidence']:.1%} {'OK' if ok else 'MISS'}")
            if len(seen) >= 3:
                break


if __name__ == "__main__":
    main()
