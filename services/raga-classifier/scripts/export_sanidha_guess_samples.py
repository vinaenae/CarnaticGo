"""Export melody clips from the Sanidha dataset for Listen & guess.

Uses vocals.wav when present, otherwise violin.wav (same multitrack folders).

Expects extracted concerts under data/sanidha/, e.g.:
  data/sanidha/Concert01/01-Vanajakshi-Varnam/Audio-Multitracks-Clean/vocals.wav
  data/sanidha/Concert01/01-Vanajakshi-Varnam/Audio-Multitracks-Clean/violin.wav
  data/sanidha/Concert01/01-Vanajakshi-Varnam/info.json

Usage:
  python services/raga-classifier/scripts/export_sanidha_guess_samples.py
  python services/raga-classifier/scripts/export_sanidha_guess_samples.py --dataset-dir data/sanidha
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import librosa
import soundfile as sf

_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_DATASET = _ROOT / "data" / "sanidha"
_OUT = _ROOT / "public" / "assets" / "raga-guess"

CLIP_SEC = 22.0
TARGET_SR = 22050
MAX_CLIPS_PER_RAGA = 3
SKIP_HEAD_SEC = 30.0

_MULTITRACK_DIRS = (
    "Audio-Multitracks-Clean",
    "Audio-Multitracks-Processed",
    "audio-multitracks-clean",
)
# Prefer vocals; fall back to violin for Listen & guess.
_LISTEN_STEMS = ("vocals", "violin")


def _find_concert_roots(dataset_dir: Path) -> list[Path]:
    roots: list[Path] = []
    if not dataset_dir.is_dir():
        return roots
    for p in sorted(dataset_dir.iterdir()):
        if p.is_dir() and re.match(r"Concert\d+", p.name, re.I):
            roots.append(p)
    nested = dataset_dir / "var" / "www" / "html" / "sanidha"
    if nested.is_dir():
        for p in sorted(nested.iterdir()):
            if p.is_dir() and re.match(r"Concert\d+", p.name, re.I) and p not in roots:
                roots.append(p)
    return roots


def _slug_id(label: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "", label.strip())
    return s[:1].upper() + s[1:] if s else "Unknown"


def _parse_raga_name(info: dict) -> str | None:
    for key in ("raag", "raga", "ragam", "Raag", "Raga", "Ragam", "Raagam"):
        val = info.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
        if isinstance(val, dict):
            for sub in ("name", "full_name", "title"):
                inner = val.get(sub)
                if isinstance(inner, str) and inner.strip():
                    return inner.strip()
    meta = info.get("metadata")
    if isinstance(meta, dict):
        return _parse_raga_name(meta)
    return None


def _pick_listen_wav(song_dir: Path) -> tuple[Path, str] | None:
    for stem in _LISTEN_STEMS:
        for folder in _MULTITRACK_DIRS:
            p = song_dir / folder / f"{stem}.wav"
            if p.is_file():
                return p, stem
    for stem in _LISTEN_STEMS:
        for p in song_dir.rglob(f"{stem}.wav"):
            if p.is_file():
                return p, stem
    return None


def _clip_window(duration_sec: float) -> tuple[int, int]:
    start = int(max(SKIP_HEAD_SEC, duration_sec * 0.12))
    end = min(int(duration_sec), start + int(CLIP_SEC))
    if end - start < 8:
        start = 0
        end = min(int(duration_sec), int(CLIP_SEC))
    return start, max(end, start + 8)


def _load_existing_out() -> tuple[dict[str, list[str]], dict[str, dict]]:
    manifest: dict[str, list[str]] = {}
    ragas_by_id: dict[str, dict] = {}
    manifest_path = _OUT / "manifest.json"
    ragas_path = _OUT / "ragas.json"
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = {}
    if ragas_path.is_file():
        try:
            raw = json.loads(ragas_path.read_text(encoding="utf-8"))
            for r in raw.get("ragas", []) if isinstance(raw, dict) else []:
                if isinstance(r, dict) and r.get("id"):
                    ragas_by_id[str(r["id"])] = r
        except json.JSONDecodeError:
            pass
    return manifest, ragas_by_id


def main() -> int:
    parser = argparse.ArgumentParser(description="Export Sanidha clips for Listen & guess")
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=_DEFAULT_DATASET,
        help="Root containing Concert01, Concert02, …",
    )
    parser.add_argument(
        "--concerts",
        type=str,
        default="",
        help="Comma-separated concert folder names to export (e.g. Concert03,Concert04). Default: all found.",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Ignore existing manifest/ragas.json (do not merge).",
    )
    args = parser.parse_args()
    dataset_dir: Path = args.dataset_dir.resolve()
    only_concerts = {
        c.strip() for c in args.concerts.split(",") if c.strip()
    } or None

    concert_roots = _find_concert_roots(dataset_dir)
    if not concert_roots:
        print(
            f"No Concert* folders under {dataset_dir}.\n"
            "Extract Sanidha archives there (full download — ~GB per concert, not ~28 MB).",
            file=sys.stderr,
        )
        return 1

    if only_concerts:
        concert_roots = [c for c in concert_roots if c.name in only_concerts]

    _OUT.mkdir(parents=True, exist_ok=True)
    if args.fresh:
        manifest, ragas_by_id = {}, {}
    else:
        manifest, ragas_by_id = _load_existing_out()

    exported_concerts: set[str] = set()

    for concert in concert_roots:
        exported_concerts.add(concert.name)
        for song_dir in sorted(concert.iterdir()):
            if not song_dir.is_dir():
                continue
            info_path = song_dir / "info.json"
            vocal_path = _pick_vocal_wav(song_dir)
            if not info_path.is_file() or vocal_path is None:
                continue

            try:
                info = json.loads(info_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                print("Skip (bad info.json):", song_dir, e, file=sys.stderr)
                continue

            raga_name = _parse_raga_name(info)
            if not raga_name:
                print("Skip (no raga in info.json):", song_dir, file=sys.stderr)
                continue

            raga_id = _slug_id(raga_name)
            if len(manifest.get(raga_id, [])) >= MAX_CLIPS_PER_RAGA:
                continue

            try:
                y, sr = librosa.load(str(audio_path), sr=TARGET_SR, mono=True)
            except Exception as e:
                print("Skip (audio load):", audio_path, e, file=sys.stderr)
                continue

            duration = len(y) / sr
            start_s, end_s = _clip_window(duration)
            clip = y[int(start_s * sr) : int(end_s * sr)]
            if len(clip) < TARGET_SR * 5:
                print("Skip (clip too short):", audio_path, file=sys.stderr)
                continue

            slug = re.sub(r"[^a-z0-9]+", "-", raga_name.lower()).strip("-") or "unknown"
            idx = len(manifest.get(raga_id, [])) + 1
            concert_tag = concert.name.lower()
            out_name = f"{concert_tag}-{stem_name}-{slug}-{idx}.wav"
            out_path = _OUT / out_name
            sf.write(out_path, clip, TARGET_SR, format="WAV")
            url = f"/assets/raga-guess/{out_name}"
            manifest.setdefault(raga_id, []).append(url)
            print(
                "Wrote",
                out_name,
                f"({raga_name}, {stem_name}, {start_s:.0f}–{end_s:.0f}s)",
            )

            if raga_id not in ragas_by_id:
                aliases: list[str] = []
                if raga_name != raga_id:
                    aliases.append(raga_name)
                ragas_by_id[raga_id] = {
                    "id": raga_id,
                    "name": raga_name,
                    "melakartaNum": None,
                    "arohanam": "",
                    "avarohanam": "",
                    "aliases": aliases,
                }

    if not manifest:
        print(
            "No clips exported. Check that Concert*.tar.gz finished downloading and extracted fully.",
            file=sys.stderr,
        )
        return 1

    ragas_list = [ragas_by_id[k] for k in sorted(ragas_by_id)]

    manifest_path = _OUT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    ragas_path = _OUT / "ragas.json"
    ragas_path.write_text(
        json.dumps(
            {
                "source": "sanidha",
                "license": "CC BY 4.0",
                "datasetUrl": "https://ccml.gtcmt.gatech.edu/data/Sanidha/",
                "concerts": sorted(exported_concerts),
                "ragas": ragas_list,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("Manifest:", manifest_path, f"({sum(len(v) for v in manifest.values())} clips)")
    print("Ragas:", ragas_path, f"({len(ragas_list)} ragas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
