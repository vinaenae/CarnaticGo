"""Simulate browser WAV re-encode on dataset audio, then classify."""

from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import soundfile as sf
from huggingface_hub import hf_hub_download

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from app.ingestion import load_audio_bytes  # noqa: E402
from app.pipeline import classify_raga_from_bytes  # noqa: E402


def float32_to_wav_bytes(samples: np.ndarray, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


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

        y = load_audio_bytes(raw)
        wav16 = float32_to_wav_bytes(y, 16000)
        roundtrip = classify_raga_from_bytes(wav16)

        print(
            f"{name:20} raw={direct['predictedRaga']:20} "
            f"wav_rt={roundtrip['predictedRaga']:20} "
            f"{'OK' if direct['predictedRaga'] == roundtrip['predictedRaga'] else 'BREAK'}"
        )
        if len(seen) >= 8:
            break


if __name__ == "__main__":
    main()
