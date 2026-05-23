"""
Build training index from KritiSamhita (Carnatic_Dataset.csv + snippets).

Used by train_tonic.py and the Colab notebook.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

TONICS = ["F#", "G", "G#", "A"]
LABEL_MAP = {t: i for i, t in enumerate(TONICS)}
KATTAI = {"F#": "4.5", "G": "5", "G#": "5.5", "A": "6"}


def parse_tonic(annotation: str, path_hint: str) -> str | None:
    text = (annotation or "").strip()
    if text:
        head = re.split(r"\s+Scale", text, maxsplit=1)[0].strip()
        head = head.replace("♯", "#").replace("♭", "b")
        for key in ("G#", "F#", "G", "A"):
            t = key.upper()
            h = head.upper()
            if h == t or h.startswith(f"{t} ") or h.startswith(f"{t}("):
                return key
    parts = Path(path_hint.replace("\\", "/")).parts
    for part in parts:
        p = part.replace("♯", "#")
        if p in LABEL_MAP:
            return p
    m = re.search(r"_([A-G]#?)_chunk", path_hint, re.I)
    if m:
        t = m.group(1).upper()
        if t in LABEL_MAP:
            return t
        if t.endswith("#") and len(t) == 2:
            cand = t[0] + "#"
            if cand in LABEL_MAP:
                return cand
    return None


def song_group(path: Path) -> str:
    m = re.match(r"^(.+?)_[A-G]#?_chunk\d+$", path.stem, re.I)
    return (m.group(1) if m else path.stem).lower()


def find_csv(dataset_dir: Path) -> Path | None:
    for name in ("Carnatic_Dataset.csv", "carnatic_dataset.csv"):
        p = dataset_dir / name
        if p.is_file():
            return p
    for p in dataset_dir.rglob("Carnatic_Dataset.csv"):
        if p.is_file():
            return p
    return None


def find_snippets_root(dataset_dir: Path) -> Path | None:
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


def _norm_header(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower().replace("_", " "))


FILE_COL_KEYS = (
    "file name",
    "filename",
    "file",
    "filepath",
    "file path",
    "path",
    "audio",
    "audio file",
    "snippet",
    "mp3",
    "relative path",
    "rel path",
)

TONIC_COL_KEYS = (
    "tonic",
    "scale",
    "kattai",
    "label",
    "shruti",
    "key",
    "tonic annotation",
    "tonic label",
    "class",
)


def resolve_csv_columns(fieldnames: list[str] | None) -> tuple[str | None, str | None]:
    """Map Mendeley / Excel CSV headers to file + tonic columns."""
    if not fieldnames:
        return None, None
    fields = {_norm_header(k): k for k in fieldnames if k and str(k).strip()}
    file_col = None
    for key in FILE_COL_KEYS:
        if key in fields:
            file_col = fields[key]
            break
    if not file_col:
        for norm, orig in fields.items():
            if any(tok in norm for tok in ("file", "path", "audio", "snippet", "mp3")):
                file_col = orig
                break
    tonic_col = None
    for key in TONIC_COL_KEYS:
        if key in fields:
            tonic_col = fields[key]
            break
    if not tonic_col:
        for norm, orig in fields.items():
            if any(tok in norm for tok in ("tonic", "scale", "kattai", "shruti")):
                tonic_col = orig
                break
    if not file_col and len(fieldnames) >= 2:
        file_col = fieldnames[0]
        if not tonic_col:
            tonic_col = fieldnames[1]
    return file_col, tonic_col


def _looks_like_mp3_path(text: str) -> bool:
    t = text.lower()
    return ".mp3" in t and ("chunk" in t or "snippets" in t or "/" in t or "\\" in t)


def _open_csv_reader(csv_path: Path) -> csv.DictReader:
    raw = csv_path.read_text(encoding="utf-8-sig")
    if not raw.strip():
        raise ValueError(f"{csv_path.name} is empty")
    sample = raw[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    lines = raw.splitlines()
    first = lines[0] if lines else ""
    # No header row: first line is already a snippet path
    if _looks_like_mp3_path(first):
        return csv.DictReader(
            lines,
            fieldnames=["File Name", "Tonic"],
            dialect=dialect,
        )
    reader = csv.DictReader(lines, dialect=dialect)
    file_col, _ = resolve_csv_columns(reader.fieldnames)
    if file_col:
        return reader
    # Header row is wrong (e.g. first data row became header)
    if reader.fieldnames and any(_looks_like_mp3_path(h or "") for h in reader.fieldnames):
        return csv.DictReader(
            lines,
            fieldnames=["File Name", "Tonic"],
            dialect=dialect,
        )
    return reader


def load_rows_from_csv(
    csv_path: Path,
    snippets_root: Path,
    source: str,
) -> tuple[list[dict], list[str]]:
    """Return (rows, fieldnames_seen) for diagnostics."""
    out: list[dict] = []
    reader = _open_csv_reader(csv_path)
    fieldnames = list(reader.fieldnames or [])
    file_col, tonic_col = resolve_csv_columns(fieldnames)
    if not file_col:
        return out, fieldnames
    for row in reader:
        path_cell = (row.get(file_col) or "").strip()
        if not path_cell or path_cell.lower() in ("file name", "filename", "path"):
            continue
        tonic_cell = (row.get(tonic_col) or "") if tonic_col else ""
        tonic = parse_tonic(tonic_cell, path_cell)
        if not tonic:
            continue
        src = resolve_audio(snippets_root, path_cell)
        if src is None or not src.is_file():
            continue
        out.append(
            {
                "path": src,
                "tonic": tonic,
                "label": LABEL_MAP[tonic],
                "group": f"{song_group(src)}_{tonic}",
                "song": song_group(src),
                "source": source,
            }
        )
    return out, fieldnames


def resolve_audio(snippets_root: Path, csv_path: str) -> Path | None:
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


def build_rows(
    dataset_dir: Path,
    *,
    extra_snippets_dir: Path | None = None,
    extra_csv: Path | None = None,
    kaggle_clips_dir: Path | None = None,
) -> list[dict]:
    """Index all labeled clips from CSV (+ optional supplement folder)."""
    dataset_dir = dataset_dir.resolve()
    csv_path = find_csv(dataset_dir)
    snippets_root = find_snippets_root(dataset_dir) or dataset_dir

    rows: list[dict] = []
    seen: set[str] = set()

    def add_row(src: Path, tonic: str, source: str) -> None:
        key = str(src.resolve())
        if key in seen:
            return
        seen.add(key)
        rows.append(
            {
                "path": src,
                "tonic": tonic,
                "label": LABEL_MAP[tonic],
                "group": f"{song_group(src)}_{tonic}",
                "song": song_group(src),
                "source": source,
            }
        )

    if csv_path and csv_path.is_file():
        csv_rows, fieldnames = load_rows_from_csv(csv_path, snippets_root, "kriti_csv")
        if not csv_rows:
            print(
                "WARN: Could not read paths from CSV. Columns found:",
                fieldnames,
                "\nUsing folder scan for MP3s instead.",
            )
        for r in csv_rows:
            add_row(r["path"], r["tonic"], r["source"])

    # Fallback: folder scan (if CSV missing rows)
    for mp3 in sorted(snippets_root.rglob("*.mp3")):
        tonic = parse_tonic(mp3.parent.name, mp3.name)
        if tonic:
            add_row(mp3, tonic, "kriti_folder")

    if extra_snippets_dir and extra_snippets_dir.is_dir():
        sup_csv = extra_csv or find_csv(extra_snippets_dir)
        sup_root = find_snippets_root(extra_snippets_dir) or extra_snippets_dir
        if sup_csv and sup_csv.is_file():
            sup_rows, _ = load_rows_from_csv(sup_csv, sup_root, "kriti_supplement")
            for r in sup_rows:
                add_row(r["path"], r["tonic"], r["source"])
        else:
            for mp3 in sorted(sup_root.rglob("*.mp3")):
                tonic = parse_tonic(mp3.parent.name, mp3.name)
                if tonic:
                    add_row(mp3, tonic, "kriti_supplement")

    if kaggle_clips_dir and kaggle_clips_dir.is_dir():
        try:
            from kaggle_carnatic_tonic import load_kaggle_training_rows

            for r in load_kaggle_training_rows(kaggle_clips_dir):
                add_row(r["path"], r["tonic"], r["source"])
        except ImportError:
            print("WARN: kaggle_carnatic_tonic.py not found — skip Kaggle clips")

    return rows
