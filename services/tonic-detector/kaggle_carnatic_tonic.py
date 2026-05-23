"""
Optional training data from Kaggle: sanjaynatesan/carnatic-song-database

That dataset is CC BY 4.0 metadata + YouTube URLs (ragam, composer, song take).
It does NOT ship audio or KritiSamhita-style tonic labels. We:

1. Download audio (yt-dlp) — you must comply with YouTube ToS.
2. Cut ~20 s vocal segments (same length as KritiSamhita).
3. Estimate Sa (shruti) via librosa pyin → map to nearest of F#, G, G#, A.
4. Keep clips only when pitch confidence is high enough.

Pre-build clips locally, then point training at the manifest (see scripts/build_kaggle_tonic_clips.py).
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

from kriti_tonic_index import KATTAI, LABEL_MAP, TONICS, parse_tonic, song_group

KAGGLE_DATASET_REF = "https://www.kaggle.com/datasets/sanjaynatesan/carnatic-song-database"
SR = 22050
CLIP_SECONDS = 20.0
CLIP_SAMPLES = int(CLIP_SECONDS * SR)

# Chart Sa Hz for our four kattai classes (match app tanpura keys)
TONIC_SA_HZ = {
    "F#": 369.99,
    "G": 392.0,
    "G#": 415.30,
    "A": 440.0,
}


def _norm_header(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower().replace("_", " "))


def find_kaggle_csv(root: Path) -> Path | None:
    for pattern in ("*.csv", "**/*.csv"):
        for p in sorted(root.glob(pattern)):
            if not p.is_file():
                continue
            try:
                head = p.read_text(encoding="utf-8-sig", errors="replace")[:4096].lower()
            except OSError:
                continue
            if "youtube" in head and ("ragam" in head or "raga" in head):
                return p
    return None


def _open_kaggle_reader(csv_path: Path) -> csv.DictReader:
    raw = csv_path.read_text(encoding="utf-8-sig")
    try:
        dialect = csv.Sniffer().sniff(raw[:8192], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    return csv.DictReader(raw.splitlines(), dialect=dialect)


def _col_map(fieldnames: list[str] | None) -> dict[str, str]:
    fields = {_norm_header(k): k for k in (fieldnames or []) if k}
    out: dict[str, str] = {}

    def pick(*keys: str, contains: str | None = None) -> str | None:
        for key in keys:
            if key in fields:
                return fields[key]
        if contains:
            for norm, orig in fields.items():
                if contains in norm:
                    return orig
        return None

    if url := pick("youtube link", "youtube", "url", "link", contains="youtube"):
        out["url"] = url
    if take := pick("song take", "take", contains="take"):
        out["take"] = take
    if name := pick("song name", "song", "title", contains="song"):
        out["song"] = name
    if ragam := pick("ragam", "raga", "ragam name", contains="ragam"):
        out["ragam"] = ragam
    return out


def iter_kaggle_metadata(csv_path: Path) -> list[dict]:
    reader = _open_kaggle_reader(csv_path)
    cols = _col_map(reader.fieldnames)
    if "url" not in cols:
        raise ValueError(
            f"Not a Kaggle Carnatic Song Database CSV (no YouTube column). "
            f"Columns: {reader.fieldnames}"
        )
    rows = []
    for row in reader:
        url = (row.get(cols["url"]) or "").strip()
        if not url or "youtube" not in url.lower():
            continue
        song = (row.get(cols.get("song", ""), "") or "").strip() or "unknown"
        ragam = (row.get(cols.get("ragam", ""), "") or "").strip()
        take = (row.get(cols.get("take", ""), "") or "").strip()
        rows.append({"url": url, "song": song, "ragam": ragam, "take": take})
    return rows


def _url_id(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:12]


def download_youtube_audio(url: str, dest: Path, timeout_sec: int = 600) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and dest.stat().st_size > 10_000:
        return True
    out_tpl = str(dest.with_suffix("")) + ".%(ext)s"
    cmd = [
        sys.executable,
        "-m",
        "yt_dlp",
        "-f",
        "bestaudio/best",
        "-x",
        "--audio-format",
        "wav",
        "--audio-quality",
        "0",
        "-o",
        out_tpl,
        "--no-playlist",
        "--socket-timeout",
        "30",
        url,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=timeout_sec)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
        return False
    wav = dest if dest.suffix == ".wav" else dest.with_suffix(".wav")
    return wav.is_file() and wav.stat().st_size > 10_000


def estimate_sa_hz(y: np.ndarray, sr: int) -> tuple[float | None, float]:
    """Median voiced F0 as proxy for Sa; return (hz, confidence 0–1)."""
    if len(y) < sr:
        return None, 0.0
    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C3"),
        fmax=librosa.note_to_hz("B5"),
        sr=sr,
    )
    mask = voiced_flag & np.isfinite(f0)
    voiced = f0[mask]
    if voiced.size < max(20, int(0.15 * len(f0))):
        return None, 0.0
    med = float(np.median(voiced))
    spread = float(np.std(voiced))
    conf = float(np.clip(1.0 - spread / max(med * 0.12, 1.0), 0.0, 1.0))
    return med, conf


def hz_to_tonic(hz: float, max_cents: float = 75.0) -> str | None:
    if hz <= 0:
        return None
    best_t, best_cents = None, 1e9
    for tonic, ref in TONIC_SA_HZ.items():
        cents = abs(1200 * np.log2(hz / ref))
        if cents < best_cents:
            best_cents, best_t = cents, tonic
    return best_t if best_cents <= max_cents else None


def segment_and_label(
    audio_path: Path,
    *,
    meta: dict,
    min_pitch_conf: float = 0.35,
) -> list[dict]:
    y, sr = librosa.load(audio_path, sr=SR, mono=True)
    if len(y) < int(8 * sr):
        return []
    hop = CLIP_SAMPLES
    clips: list[dict] = []
    n_seg = max(1, len(y) // hop)
    for i in range(min(n_seg, 6)):  # up to 6 × 20 s per recording
        chunk = y[i * hop : i * hop + hop]
        if len(chunk) < int(10 * sr):
            continue
        if len(chunk) < CLIP_SAMPLES:
            chunk = np.pad(chunk, (0, CLIP_SAMPLES - len(chunk)))
        else:
            chunk = chunk[:CLIP_SAMPLES]
        sa_hz, conf = estimate_sa_hz(chunk, sr)
        if sa_hz is None or conf < min_pitch_conf:
            continue
        tonic = hz_to_tonic(sa_hz)
        if not tonic:
            continue
        safe_song = re.sub(r"[^\w\-]+", "_", meta.get("song", "song"))[:40]
        clip_id = f"{_url_id(meta['url'])}_{i}"
        clips.append(
            {
                "id": clip_id,
                "segment_index": i,
                "tonic": tonic,
                "label": LABEL_MAP[tonic],
                "sa_hz": sa_hz,
                "pitch_confidence": conf,
                "song": meta.get("song", ""),
                "ragam": meta.get("ragam", ""),
                "take": meta.get("take", ""),
                "source": "kaggle_carnatic_pitch",
                "group": f"kaggle_{safe_song}_{tonic}",
            }
        )
    return clips


def build_clips_from_kaggle_csv(
    csv_path: Path,
    out_dir: Path,
    *,
    max_downloads: int = 0,
    min_pitch_conf: float = 0.35,
    cache_dir: Path | None = None,
) -> dict:
    """
    Download (optional cap), segment, label, write WAV + manifest.json under out_dir.
    max_downloads=0 means all rows (can take hours).
    """
    out_dir = out_dir.resolve()
    clips_dir = out_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)
    cache = cache_dir or (out_dir / "youtube_cache")
    cache.mkdir(parents=True, exist_ok=True)

    meta_rows = iter_kaggle_metadata(csv_path)
    manifest_clips: list[dict] = []
    downloaded = 0
    skipped = 0

    for idx, meta in enumerate(meta_rows):
        if max_downloads and downloaded >= max_downloads:
            break
        uid = _url_id(meta["url"])
        wav_path = cache / f"{uid}.wav"
        if not download_youtube_audio(meta["url"], wav_path):
            skipped += 1
            continue
        downloaded += 1
        labeled = segment_and_label(wav_path, meta=meta, min_pitch_conf=min_pitch_conf)
        y_full, _ = librosa.load(wav_path, sr=SR, mono=True)
        for clip in labeled:
            wav_out = clips_dir / f"{clip['id']}.wav"
            start = int(clip["segment_index"]) * CLIP_SAMPLES
            seg = y_full[start : start + CLIP_SAMPLES]
            if len(seg) < CLIP_SAMPLES:
                seg = np.pad(seg, (0, CLIP_SAMPLES - len(seg)))
            sf.write(wav_out, seg, SR)
            manifest_clips.append({**clip, "path": str(wav_out)})

    manifest = {
        "source": KAGGLE_DATASET_REF,
        "license": "CC BY 4.0",
        "label_method": "librosa pyin Sa → nearest F#/G/G#/A",
        "n_clips": len(manifest_clips),
        "n_downloads_attempted": downloaded,
        "n_skipped_download": skipped,
        "clips": manifest_clips,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def load_kaggle_training_rows(clips_dir: Path) -> list[dict]:
    """Load pre-built clips from manifest.json for merging into training."""
    manifest_path = clips_dir / "manifest.json"
    if not manifest_path.is_file():
        return []
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = []
    for clip in data.get("clips", []):
        p = Path(clip["path"])
        if not p.is_file():
            p = clips_dir / "clips" / p.name
        if not p.is_file():
            continue
        tonic = clip.get("tonic")
        if tonic not in LABEL_MAP:
            tonic = parse_tonic(str(tonic), str(p))
        if not tonic:
            continue
        song = clip.get("song") or song_group(p)
        rows.append(
            {
                "path": p,
                "tonic": tonic,
                "label": LABEL_MAP[tonic],
                "group": clip.get("group") or f"kaggle_{song}_{tonic}",
                "song": song,
                "source": clip.get("source", "kaggle_carnatic_pitch"),
            }
        )
    return rows
