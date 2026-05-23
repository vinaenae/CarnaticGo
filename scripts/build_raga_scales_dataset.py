#!/usr/bin/env python3
"""
Build data/raga-scales/dataset.json from open sources (no app integration).

Primary source: ssrihari/ragavardhini (ragas.md + ragams.psv) — ~5k raga names with
arohanam / avarohanam in letter notation (s, r1, g3, …).

Optional: --audio downloads reference clips from sarayusapa/carnatic-ragas (HF) when
raga labels match — these are vocal performances, not isolated scale exercises.

Usage:
  python scripts/build_raga_scales_dataset.py
  python scripts/build_raga_scales_dataset.py --audio --audio-limit 200
"""

from __future__ import annotations

import argparse
import io
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data" / "raga-scales"
OUT_JSON = OUT_DIR / "dataset.json"
RAGAVARDHINI_MD = RAW / "ragavardhini-ragas.md"
RAGAVARDHINI_PSV = RAW / "ragavardhini-ragams.psv"

SWARA_MAP = {
    "s": "S",
    "r1": "R₁",
    "r2": "R₂",
    "r3": "R₃",
    "g1": "G₁",
    "g2": "G₂",
    "g3": "G₃",
    "m1": "M₁",
    "m2": "M₂",
    "p": "P",
    "d": "D₁",
    "d1": "D₁",
    "d2": "D₂",
    "n": "N₂",
    "n1": "N₁",
    "n2": "N₂",
    "n3": "N₃",
}

# 72 melakarta — computed (Katapayādi order, standard S G M P D N variants)
def _melakarta_scales() -> list[dict]:
    rows: list[dict] = []
    names = [
        "Kanakangi", "Ratnangi", "Ganamurti", "Vanaspati", "Manavati", "Tanarupi",
        "Senavati", "Hanumatodi", "Dhenuka", "Natakapriya", "Kokilapanchami", "Rupavati",
        "Gayakapriya", "Vakulabharanam", "Mayamalavagowla", "Chakravakam",
        "Suryakantam", "Hatakambhari", "Jhankaradhwani", "Natabhairavi", "Keeravani",
        "Kharaharapriya", "Gourimanohari", "Varunapriya", "Mararanjani", "Charukesi",
        "Sarasangi", "Harikambhoji", "Dheerasankarabharanam", "Naganandini", "Yagapriya",
        "Ragavardhini", "Gangeyabhusani", "Vagadheeswari", "Sulini", "Chalanata",
        "Salagam", "Jalarnavam", "Jhalavarali", "Navaneetam", "Pavani", "Raghupriya",
        "Gavambhodi", "Bhavapriya", "Shubhapantuvarali", "Shadvidamargini", "Suvarnangi",
        "Divyamani", "Dhavalambari", "Namanarayani", "Kamavardani", "Ramapriya",
        "Gamanashrama", "Vishwambari", "Shamalangi", "Shanmukhapriya", "Simhendramadhyamam",
        "Hemavati", "Dharmavati", "Neetimati", "Kantamani", "Rishabhapriya", "Latangi",
        "Vachaspati", "Mechakalyani", "Chitrambari", "Sucharitra", "Jyotiswarupini",
        "Dhatuvardani", "Nasikabhusani", "Kosalam", "Rasikapriya",
    ]
    g_triples = [
        ("G₁", "G₁"), ("G₁", "G₂"), ("G₁", "G₃"),
        ("G₂", "G₂"), ("G₂", "G₃"), ("G₃", "G₃"),
    ]
    d_pairs = [("D₁", "D₁"), ("D₁", "D₂"), ("D₂", "D₂")]
    n_triples = [("N₁", "N₁"), ("N₁", "N₂"), ("N₁", "N₃"), ("N₂", "N₂"), ("N₂", "N₃"), ("N₃", "N₃")]

    for m in range(1, 73):
        i = m - 1
        r = "R₁" if i < 36 else "R₂"
        g = g_triples[(i % 36) // 6]
        mi = "M₁" if (i % 6) < 3 else "M₂"
        d = d_pairs[(i % 6) // 3]
        n = n_triples[i % 6]
        aro = f"S {r} {g[0]} {mi} P {d[0]} {n[0]} Ṡ"
        ava = f"Ṡ {n[1]} {d[1]} P {mi} {g[1]} {r} S"
        rows.append(
            {
                "id": names[i].lower().replace(" ", "_"),
                "name": names[i],
                "melakarta_num": m,
                "arohanam": aro,
                "avarohanam": ava,
                "arohanam_raw": aro,
                "avarohanam_raw": ava,
                "source": "computed_melakarta_72",
                "is_melakarta": True,
            }
        )
    return rows


def _slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name.lower())
    s = "".join(c for c in s if c.isalnum())
    return s or "unknown"


def _normalize_scale_text(raw: str) -> str:
    raw = raw.strip().lower().replace("s.", "Ṡ").replace("upper s", "Ṡ")
    parts = re.split(r"[\s,]+", raw)
    out: list[str] = []
    for p in parts:
        p = p.strip(".")
        if not p:
            continue
        if p in ("s", "ṣ", "ś"):
            out.append("S")
        elif p.startswith("s") and len(p) > 1:
            out.append("Ṡ" if "upper" in p else SWARA_MAP.get(p, p.upper()))
        else:
            out.append(SWARA_MAP.get(p, p.upper()))
    return " ".join(out)


def _parse_md_line(line: str) -> dict | None:
    line = line.strip()
    if not line or line.startswith("|--") or line.startswith("|No."):
        return None
    if not re.match(r"^\d+\|", line):
        return None
    parts = line.split("|")
    if len(parts) < 4:
        return None
    idx, name, aro, ava = parts[0], parts[1].strip(), parts[2].strip(), parts[3].strip()
    if not name or not aro or not ava:
        return None
    return {
        "id": _slug(name),
        "name": name,
        "index": int(idx) if idx.isdigit() else None,
        "arohanam_raw": aro,
        "avarohanam_raw": ava,
        "arohanam": _normalize_scale_text(aro),
        "avarohanam": _normalize_scale_text(ava),
        "melakarta_num": None,
        "source": "ragavardhini_ragas_md",
        "is_melakarta": False,
    }


def _parse_psv_line(line: str) -> dict | None:
    line = line.strip()
    if not line:
        return None
    parts = line.split("|")
    if len(parts) < 4:
        return None
    name = parts[0].strip()
    aro = parts[2].strip() if len(parts) > 2 else ""
    ava = parts[3].strip() if len(parts) > 3 else ""
    mel = None
    if len(parts) > 4 and parts[4].strip().isdigit():
        mel = int(parts[4].strip())
    if not name or not aro or not ava:
        return None
    return {
        "id": _slug(name),
        "name": name,
        "index": None,
        "arohanam_raw": aro,
        "avarohanam_raw": ava,
        "arohanam": _normalize_scale_text(aro),
        "avarohanam": _normalize_scale_text(ava),
        "melakarta_num": mel,
        "source": "ragavardhini_ragams_psv",
        "is_melakarta": False,
    }


def _merge_entries(entries: list[dict]) -> list[dict]:
    by_id: dict[str, dict] = {}
    for e in entries:
        key = e["id"]
        if key not in by_id:
            by_id[key] = e
            continue
        prev = by_id[key]
        if prev.get("melakarta_num") is None and e.get("melakarta_num") is not None:
            e = {**prev, **e}
            by_id[key] = e
    return sorted(by_id.values(), key=lambda x: x["name"].lower())


def _ensure_raw_downloads() -> None:
    import urllib.request

    RAW.mkdir(parents=True, exist_ok=True)
    base = "https://raw.githubusercontent.com/ssrihari/ragavardhini/master/ragas"
    for name, out in [
        ("ragas.md", RAGAVARDHINI_MD),
        ("ragams.psv", RAGAVARDHINI_PSV),
    ]:
        if out.exists() and out.stat().st_size > 1000:
            continue
        url = f"{base}/{name}"
        print("Downloading", url)
        urllib.request.urlretrieve(url, out)


def _download_hf_audio(entries: list[dict], limit: int) -> None:
    try:
        import librosa
        import pyarrow.parquet as pq
        import soundfile as sf
        from huggingface_hub import hf_hub_download
    except ImportError as e:
        print("Skip audio: install huggingface_hub pyarrow soundfile librosa —", e)
        return

    audio_dir = OUT_DIR / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    # HF carnatic-ragas uses these 8 labels (see export_guess_samples.py)
    hf_label_to_slug = {
        "amritavarshini": "amrithavarshini",
        "hamsanaadam": "hamsanadam",
        "kalyani": "kalyani",
        "kharaharapriya": "kharaharapriya",
        "mayamalavagoulai": "mayamalavagowla",
        "sindhubhairavi": "sindhubhairavi",
        "todi": "hanumatodi",
        "varali": "varali",
    }

    # Build lookup: normalized name -> entry ids
    name_keys: dict[str, list[str]] = {}
    for e in entries:
        for key in {_slug(e["name"]), e["id"]}:
            name_keys.setdefault(key, []).append(e["id"])
    for hf_slug in hf_label_to_slug.values():
        if hf_slug in {e["id"] for e in entries}:
            name_keys.setdefault(hf_slug, []).append(
                next(e["id"] for e in entries if e["id"] == hf_slug)
            )

    matched: dict[str, list[dict]] = {}
    target = limit

    for shard in range(5):
        if sum(len(v) for v in matched.values()) >= target:
            break
        path = hf_hub_download(
            repo_id="sarayusapa/carnatic-ragas",
            repo_type="dataset",
            filename=f"data/train-0000{shard}-of-00005.parquet",
        )
        table = pq.read_table(path)
        for i in range(table.num_rows):
            row = {n: table.column(n)[i].as_py() for n in table.column_names}
            raga = str(row.get("raga", ""))
            key = hf_label_to_slug.get(_slug(raga), _slug(raga))
            if key not in name_keys:
                continue
            for eid in dict.fromkeys(name_keys[key]):
                if eid in matched and len(matched[eid]) >= 2:
                    continue
                audio_bytes = row["audio"]["bytes"]
                y, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000, mono=True)
                idx = len(matched.get(eid, [])) + 1
                fname = f"{eid}-{idx}.wav"
                out_path = audio_dir / fname
                sf.write(out_path, y, 16000, format="WAV")
                rec = {
                    "file": f"audio/{fname}",
                    "duration_sec": round(len(y) / sr, 2),
                    "hf_raga_label": raga,
                    "audio_kind": "vocal_performance_sample",
                    "note": "Not verified as isolated arohanam/avarohanam; from carnatic-ragas dataset.",
                }
                matched.setdefault(eid, []).append(rec)
                print("Audio", fname, "<-", raga)
                if sum(len(v) for v in matched.values()) >= target:
                    break

    for e in entries:
        clips = matched.get(e["id"], [])
        if clips:
            e["audio_clips"] = clips


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", action="store_true", help="Download HF audio samples")
    parser.add_argument("--audio-limit", type=int, default=150, help="Max audio clips")
    args = parser.parse_args()

    _ensure_raw_downloads()
    entries: list[dict] = []

    if RAGAVARDHINI_MD.exists():
        for line in RAGAVARDHINI_MD.read_text(encoding="utf-8").splitlines():
            row = _parse_md_line(line)
            if row:
                entries.append(row)
        print("Parsed MD:", len(entries))

    psv_count = 0
    if RAGAVARDHINI_PSV.exists():
        for line in RAGAVARDHINI_PSV.read_text(encoding="utf-8").splitlines():
            row = _parse_psv_line(line)
            if row:
                entries.append(row)
                psv_count += 1
        print("Parsed PSV:", psv_count)

    entries = _merge_entries(entries)
    melakarta = _melakarta_scales()
    entries = _merge_entries(melakarta + entries)

    if args.audio:
        _download_hf_audio(entries, args.audio_limit)

    with_audio = sum(1 for e in entries if e.get("audio_clips"))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sources": [
            {
                "name": "ragavardhini",
                "url": "https://github.com/ssrihari/ragavardhini/tree/master/ragas",
                "license": "Check upstream repository",
            },
            {
                "name": "melakarta_72_computed",
                "note": "Standard melakarta scale pattern; verify against authoritative texts.",
            },
            {
                "name": "sarayusapa/carnatic-ragas",
                "url": "https://huggingface.co/datasets/sarayusapa/carnatic-ragas",
                "used_for": "optional audio clips only",
            },
        ],
        "stats": {
            "total_ragas": len(entries),
            "with_audio": with_audio,
            "melakarta_count": sum(1 for e in entries if e.get("is_melakarta")),
        },
        "audio_disclaimer": (
            "Downloaded clips are vocal performances from Hugging Face, not dedicated "
            "arohanam/avarohanam exercises. Pure scale audio is rarely published as separate files."
        ),
        "ragas": entries,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON, "—", len(entries), "ragas,", with_audio, "with audio")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
