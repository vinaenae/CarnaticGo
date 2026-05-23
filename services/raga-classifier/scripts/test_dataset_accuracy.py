"""Quick sanity check: classify samples from sarayusapa/carnatic-ragas."""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import pyarrow.parquet as pq
import soundfile as sf
from huggingface_hub import hf_hub_download

# Ensure weights dir when run from repo root
_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))
os.environ.setdefault(
    "SAM_CARNATIC_WEIGHTS_DIR",
    str(_ROOT / "weights" / "sam-carnatic"),
)

from app.pipeline import classify_raga_from_bytes  # noqa: E402


def main() -> int:
    mode = os.getenv("RAGA_INFERENCE_MODE", "readme")
    print(f"RAGA_INFERENCE_MODE={mode}")
    seen: set[str] = set()
    hits = 0
    total = 0
    for shard in range(5):
        parquet_path = hf_hub_download(
            repo_id="sarayusapa/carnatic-ragas",
            repo_type="dataset",
            filename=f"data/train-0000{shard}-of-00005.parquet",
        )
        table = pq.read_table(parquet_path)
        for i in range(table.num_rows):
            if total >= 8:
                break
            row = {name: table.column(name)[i].as_py() for name in table.column_names}
            label = row.get("label") or row.get("raga") or row.get("labels")
            if isinstance(label, list):
                label = label[0]
            name = str(label)
            if name in seen:
                continue
            seen.add(name)
            audio = row["audio"]
            buf = io.BytesIO(audio["bytes"])
            r = classify_raga_from_bytes(buf.read())
            pred = r["predictedRaga"]
            ok = pred.lower().replace(" ", "") == name.lower().replace(" ", "")
            hits += int(ok)
            total += 1
            tag = "OK" if ok else "MISS"
            print(f"{name:22} -> {pred:22} {r['confidence']:.1%} {tag}")
        if total >= 8:
            break
    print(f"\n{hits}/{total} correct on one sample per raga")
    return 0 if hits == total else 1


if __name__ == "__main__":
    sys.exit(main())
