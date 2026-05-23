"""Compare direct classify vs HTTP for raw dataset bytes."""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pyarrow.parquet as pq
import requests
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
    for i in range(table.num_rows):
        row = {name: table.column(name)[i].as_py() for name in table.column_names}
        name = str(row["raga"])
        if name in seen:
            continue
        seen.add(name)
        raw = row["audio"]["bytes"]
        direct = classify_raga_from_bytes(raw)
        try:
            r = requests.post(
                "http://127.0.0.1:8001/classify/raga",
                files={"file": ("clip.wav", raw, "audio/wav")},
                timeout=120,
            )
            http = r.json() if r.ok else {"error": r.status_code, "text": r.text[:300]}
        except Exception as e:
            http = {"error": str(e)}
        http_pred = http.get("predictedRaga", http)
        match = http_pred == direct["predictedRaga"]
        print(
            f"{name:20} direct={direct['predictedRaga']:20} {direct['confidence']:.1%} "
            f"http={str(http_pred):20} {'SAME' if match else 'DIFF'}"
        )
        if len(seen) >= 8:
            break


if __name__ == "__main__":
    main()
