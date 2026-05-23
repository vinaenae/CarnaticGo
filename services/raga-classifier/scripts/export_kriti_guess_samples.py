"""Export KritiSamhita snippets for the Match the tanpura quiz."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

import librosa
import soundfile as sf

_ROOT = Path(__file__).resolve().parents[3]
_OUT = _ROOT / "public" / "assets" / "kriti-guess"
_CLIPS = _OUT / "clips"
_SR = 22050

_TONIC_TO_KEY = {
    "F#": ("F#", "kattai_4_5"),
    "G": ("G", "kattai_5"),
    "G#": ("G#", "kattai_5_5"),
    "A": ("A", "kattai_6"),
}

_KRITI_META = {
    "source": "kriti-samhita",
    "version": 1,
    "clipSeconds": 20.0,
    "license": "CC BY 4.0",
    "licenseName": "Creative Commons Attribution 4.0 International",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "datasetUrl": "https://data.mendeley.com/datasets/nkdm57hvw3/2",
    "datasetDoi": "10.17632/nkdm57hvw3.2",
    "datasetDoiUrl": "https://doi.org/10.17632/nkdm57hvw3.2",
    "datasetCitation": (
        "Konduri S., Pendyala K., Pendyala V. (2024). KritiSamhita: South Indian Music "
        "Tonic Recognition Dataset (Audio) [Data set]. Mendeley Data. "
        "https://doi.org/10.17632/nkdm57hvw3.2"
    ),
    "paperUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11286976/",
    "paperDoi": "10.1016/j.dib.2024.110730",
    "citation": (
        "Konduri S., Pendyala K., Pendyala V. (2024). KritiSamhita: A machine learning "
        "dataset of South Indian classical music audio clips with tonic classification. "
        "Data in Brief, 55, 110730. https://doi.org/10.1016/j.dib.2024.110730"
    ),
    "modifications": (
        "Mono WAV at 22050 Hz from published 20 s MP3 snippets for an educational "
        "match-the-tanpura quiz."
    ),
}


def _parse_tonic(annotation: str, path_hint: str) -> str | None:
    text = (annotation or "").strip()
    if text:
        head = re.split(r"\s+Scale", text, maxsplit=1)[0].strip()
        head = head.replace("♯", "#").replace("♭", "b")
        # Longer keys first (G# before G).
        for key in ("G#", "F#", "G", "A"):
            t = key.upper()
            h = head.upper()
            if h == t or h.startswith(f"{t} ") or h.startswith(f"{t}("):
                return key
    parts = Path(path_hint.replace("\\", "/")).parts
    for part in parts:
        p = part.replace("♯", "#")
        if p in _TONIC_TO_KEY:
            return p
    m = re.search(r"_([A-G]#?)_chunk", path_hint, re.I)
    if m:
        t = m.group(1).upper()
        if t == "G":
            return "G"
        if t.endswith("#"):
            return t[0] + "#"
        return t
    return None


def _song_name(filename: str) -> str:
    stem = Path(filename).stem
    m = re.match(r"^(.+?)_[A-G]#?_chunk\d+$", stem, re.I)
    return (m.group(1) if m else stem).replace("_", " ").strip()


def _find_csv(dataset_dir: Path) -> Path | None:
    for name in ("Carnatic_Dataset.csv", "carnatic_dataset.csv"):
        p = dataset_dir / name
        if p.is_file():
            return p
    for p in dataset_dir.rglob("Carnatic_Dataset.csv"):
        if p.is_file():
            return p
    return None


def _find_snippets_root(dataset_dir: Path) -> Path | None:
    for name in (
        "Carnatic_Dataset_Snippets",
        "Carnatic Dataset Snippets",
        "carnatic_dataset_snippets",
    ):
        p = dataset_dir / name
        if p.is_dir():
            return p
    for p in dataset_dir.rglob("Carnatic_Dataset_Snippets"):
        if p.is_dir():
            return p
    return None


def _resolve_audio(snippets_root: Path, csv_path: str) -> Path | None:
    rel = csv_path.replace("\\", "/").strip()
    for prefix in (
        "Carnatic_Dataset_Snippets/",
        "Carnatic Dataset Snippets/",
        "carnatic_dataset_snippets/",
    ):
        if rel.lower().startswith(prefix.lower()):
            rel = rel[len(prefix) :]
            break
    candidate = snippets_root / rel
    if candidate.is_file():
        return candidate
    name = Path(rel).name
    hits = list(snippets_root.rglob(name))
    return hits[0] if hits else None


def _iter_rows(dataset_dir: Path, csv_path: Path | None, snippets_root: Path | None):
    if csv_path and csv_path.is_file():
        with csv_path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            fields = {k.strip().lower(): k for k in (reader.fieldnames or [])}
            file_col = fields.get("file name") or fields.get("filename") or fields.get("path")
            tonic_col = fields.get("tonic")
            if not file_col:
                print("CSV missing File Name column", file=sys.stderr)
                return
            for row in reader:
                path_cell = (row.get(file_col) or "").strip()
                tonic_cell = (row.get(tonic_col) or "") if tonic_col else ""
                yield path_cell, tonic_cell
        return

    if not snippets_root:
        return
    for mp3 in sorted(snippets_root.rglob("*.mp3")):
        rel = mp3.relative_to(snippets_root)
        yield str(rel), mp3.parent.name


def _export_clip(src: Path, dest: Path) -> float:
    y, _ = librosa.load(src, sr=_SR, mono=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    sf.write(dest, y, _SR, format="WAV")
    return float(len(y) / _SR)


def _manifest_from_disk() -> dict:
    clips = []
    for wav in sorted(_CLIPS.glob("*.wav")):
        meta_path = wav.with_suffix(".json")
        if meta_path.is_file():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        else:
            meta = {}
        clips.append(
            {
                "id": wav.stem,
                "url": f"/assets/kriti-guess/clips/{wav.name}",
                "tonic": meta.get("tonic", "G"),
                "kattaiKey": meta.get("kattaiKey", "kattai_5"),
                "songName": meta.get("songName", wav.stem),
                "durationSeconds": meta.get("durationSeconds", 20.0),
            }
        )
    return {**_KRITI_META, "clips": clips}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=_ROOT / "data" / "kriti-samhita",
        help="Folder with Carnatic_Dataset.csv and Carnatic_Dataset_Snippets/",
    )
    parser.add_argument("--max-clips", type=int, default=0, help="0 = export all")
    parser.add_argument(
        "--per-tonic",
        type=int,
        default=0,
        help="Cap per tonic class (0 = no cap unless --max-clips set)",
    )
    parser.add_argument(
        "--manifest-only",
        action="store_true",
        help="Rebuild manifest.json from clips/*.wav + sidecar *.json",
    )
    args = parser.parse_args()

    _OUT.mkdir(parents=True, exist_ok=True)
    _CLIPS.mkdir(parents=True, exist_ok=True)

    if args.manifest_only:
        manifest = _manifest_from_disk()
        out_path = _OUT / "manifest.json"
        out_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"Wrote {out_path} ({len(manifest['clips'])} clips)")
        return 0

    dataset_dir = args.dataset_dir.resolve()
    csv_path = _find_csv(dataset_dir)
    snippets_root = _find_snippets_root(dataset_dir)
    if not snippets_root and dataset_dir.is_dir():
        snippets_root = dataset_dir

    if not csv_path and not snippets_root:
        print(
            f"No KritiSamhita data under {dataset_dir}. "
            "Download from https://data.mendeley.com/datasets/nkdm57hvw3/2 "
            "and unzip Carnatic_Dataset_Snippets.zip + Carnatic_Dataset.csv there.",
            file=sys.stderr,
        )
        return 1

    per_tonic: dict[str, int] = {t: 0 for t in _TONIC_TO_KEY}
    exported = 0
    clips: list[dict] = []

    for path_cell, tonic_cell in _iter_rows(dataset_dir, csv_path, snippets_root):
        if args.max_clips and exported >= args.max_clips:
            break
        tonic = _parse_tonic(tonic_cell, path_cell)
        if not tonic:
            continue
        if args.per_tonic and per_tonic[tonic] >= args.per_tonic:
            continue
        if not args.per_tonic and args.max_clips == 0:
            pass
        src = _resolve_audio(snippets_root, path_cell) if snippets_root else None
        if src is None and Path(path_cell).is_file():
            src = Path(path_cell)
        if src is None or not src.is_file():
            continue

        clip_id = hashlib.sha1(str(src).encode()).hexdigest()[:16]
        wav_name = f"{clip_id}.wav"
        dest = _CLIPS / wav_name
        if not dest.is_file():
            try:
                dur = _export_clip(src, dest)
            except Exception as exc:
                print(f"Skip {src.name}: {exc}", file=sys.stderr)
                continue
        else:
            y, _ = librosa.load(dest, sr=_SR, mono=True)
            dur = float(len(y) / _SR)

        song = _song_name(src.name)
        _, kattai_key = _TONIC_TO_KEY[tonic]
        sidecar = {
            "tonic": tonic,
            "kattaiKey": kattai_key,
            "songName": song,
            "durationSeconds": round(dur, 2),
        }
        dest.with_suffix(".json").write_text(json.dumps(sidecar), encoding="utf-8")
        clips.append(
            {
                "id": clip_id,
                "url": f"/assets/kriti-guess/clips/{wav_name}",
                **sidecar,
            }
        )
        per_tonic[tonic] += 1
        exported += 1
        print(f"Exported {src.name} -> {wav_name} ({tonic})")

    manifest = {**_KRITI_META, "clips": clips}
    manifest_path = _OUT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Manifest: {manifest_path} ({len(clips)} clips)")
    return 0 if clips else 1


if __name__ == "__main__":
    sys.exit(main())
