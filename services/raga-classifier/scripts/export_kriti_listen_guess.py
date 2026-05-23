"""Export KritiSamhita clips for Listen & guess (raga labels from *-shruti-raga-map.json)."""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import zipfile
from pathlib import Path

import librosa
import soundfile as sf

_ROOT = Path(__file__).resolve().parents[3]
_DATASET = _ROOT / "data" / "kriti-samhita"
_OUT = _ROOT / "public" / "assets" / "raga-guess"
_SR = 22050

_RAGA_META: dict[str, dict] = {
    "Kalyani": {"melakartaNum": 65, "aliases": ["Mechakalyani"]},
    "Sreeranjani": {"melakartaNum": None, "aliases": []},
    "Asaveri": {"melakartaNum": None, "aliases": []},
    "Yadukula Kambhoji": {"melakartaNum": None, "aliases": ["Yadukulakambhoji", "Kambhoji"]},
    "Hindolam": {"melakartaNum": None, "aliases": []},
    "Kambhoji": {"melakartaNum": 28, "aliases": []},
    "Shankarabharanam": {"melakartaNum": 29, "aliases": ["Sankarabharanam"]},
    "Mohanam": {"melakartaNum": None, "aliases": []},
    "Kedaram": {"melakartaNum": None, "aliases": ["Kedaragaula"]},
    "Todi": {"melakartaNum": 8, "aliases": ["Hanumatodi", "Hanumathodi"]},
    "Malahari": {"melakartaNum": None, "aliases": []},
    "Bilahari": {"melakartaNum": None, "aliases": []},
    "Mukhari": {"melakartaNum": None, "aliases": []},
    "Bhairavi": {"melakartaNum": None, "aliases": []},
    "Sahana": {"melakartaNum": None, "aliases": []},
    "Surutti": {"melakartaNum": None, "aliases": ["Suruti", "Shuddhasaveri"]},
    "Hamsadhwani": {"melakartaNum": None, "aliases": []},
    "Suddha Saveri": {"melakartaNum": None, "aliases": ["Suddhasaveri", "Shuddha Saveri"]},
    "Devagandhari": {"melakartaNum": None, "aliases": ["Devagandhari", "Devgandhari"]},
    "Abhogi": {"melakartaNum": None, "aliases": []},
    "Jaganmohini": {"melakartaNum": None, "aliases": []},
    "Arabhi": {"melakartaNum": 29, "aliases": []},
    "Vasanta": {"melakartaNum": None, "aliases": ["Vasanti"]},
    "Mayamalavagowla": {
        "melakartaNum": 15,
        "aliases": ["Mayamalavagaula", "Malavagowla", "Maayamalavagowla"],
    },
    "Anandabhairavi": {"melakartaNum": None, "aliases": ["Anandha Bhairavi"]},
    "Kurinji": {"melakartaNum": None, "aliases": []},
    "Swaravali": {"melakartaNum": None, "aliases": ["Svaravali"]},
    "Esha Manohari": {"melakartaNum": None, "aliases": ["Eshamanohari"]},
    "Sindhu Bhairavi": {"melakartaNum": None, "aliases": ["Sindhubhairavi"]},
}

_TONIC_PREFIX = {"A": "kriti-a", "F#": "kriti-fs", "G": "kriti-g", "G#": "kriti-gs"}


def _slug_id(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "", name.strip())
    return s[:1].upper() + s[1:] if s else "Unknown"


def _norm_song_key(name: str) -> str:
    name = re.sub(r"\s*\(\d+\)\s*$", "", name.strip())
    name = re.sub(r"\s*\([^)]+\)\s*", " ", name)
    name = re.sub(r"\s*-\s*.+$", "", name)
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def _song_from_mp3_stem(stem: str) -> str:
    m = re.match(r"^(.+?)_[A-G]#?_chunk\d+$", stem, re.I)
    raw = (m.group(1) if m else stem).replace("_", " ").strip()
    raw = re.sub(r"\s*\(\d+\)\s*$", "", raw)
    raw = re.sub(r"\s*-\s*.+$", "", raw)
    raw = re.sub(r"\s*\([^)]+\)\s*", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def _load_map(path: Path) -> tuple[str, dict[str, str], dict[str, list[str]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    tonic = str(raw.get("tonic", "A"))
    songs = raw.get("songs") or {}
    also = raw.get("alsoAccept") or {}
    out: dict[str, str] = {}
    for k, v in songs.items():
        if isinstance(k, str) and isinstance(v, str):
            out[_norm_song_key(k)] = v.strip()
    extra: dict[str, list[str]] = {}
    for k, vals in also.items():
        if isinstance(k, str) and isinstance(vals, list):
            extra[_norm_song_key(k)] = [str(x).strip() for x in vals if x]
    return tonic, out, extra


def _find_zip(dataset_dir: Path) -> Path | None:
    p = dataset_dir / "Carnatic_Dataset_Snippets.zip"
    return p if p.is_file() else None


def _pick_mp3_for_song(z: zipfile.ZipFile, tonic: str, song_key: str) -> zipfile.ZipInfo | None:
    prefix = f"Carnatic_Dataset_Snippets/{tonic}/"
    best: zipfile.ZipInfo | None = None
    for info in z.infolist():
        if not info.filename.endswith(".mp3"):
            continue
        if not info.filename.replace("\\", "/").startswith(prefix):
            continue
        stem = Path(info.filename).stem
        if _norm_song_key(_song_from_mp3_stem(stem)) == song_key:
            if best is None or "chunk0" in stem.lower():
                best = info
            if "chunk0" in stem.lower():
                return info
    return best


def _map_files(dataset_dir: Path, tonic_filter: str | None) -> list[Path]:
    maps = sorted(dataset_dir.glob("*-shruti-raga-map.json"))
    if not maps:
        legacy = dataset_dir / "a-shruti-raga-map.json"
        if legacy.is_file():
            maps = [legacy]
    if tonic_filter and tonic_filter != "all":
        maps = [m for m in maps if _load_map(m)[0] == tonic_filter]
    return maps


def _export_tonic(
    z: zipfile.ZipFile,
    map_path: Path,
    manifest: dict[str, list[str]],
    ragas_by_id: dict[str, dict],
    clip_answers: dict[str, dict],
    fresh_prefix: str | None,
) -> int:
    tonic, song_to_raga, also_accept = _load_map(map_path)
    prefix = _TONIC_PREFIX.get(tonic, f"kriti-{tonic.lower().replace('#', 's')}")
    exported_songs: set[str] = set()
    count = 0

    if fresh_prefix:
        for wav in _OUT.glob(f"{fresh_prefix}-*.wav"):
            wav.unlink()

    for norm_key, raga_name in song_to_raga.items():
        if norm_key in exported_songs:
            continue
        info = _pick_mp3_for_song(z, tonic, norm_key)
        if info is None:
            print("Skip (no mp3):", tonic, norm_key, file=sys.stderr)
            continue

        song_label = _song_from_mp3_stem(Path(info.filename).stem)
        raga_id = _slug_id(raga_name)
        slug = re.sub(r"[^a-z0-9]+", "-", song_label.lower()).strip("-") or "song"
        out_name = f"{prefix}-{slug}.wav"
        out_path = _OUT / out_name

        try:
            with z.open(info) as f:
                data = f.read()
            y, _ = librosa.load(io.BytesIO(data), sr=_SR, mono=True)
            sf.write(out_path, y, _SR, format="WAV")
        except Exception as exc:
            print("Skip (load):", info.filename, exc, file=sys.stderr)
            continue

        url = f"/assets/raga-guess/{out_name}"
        manifest.setdefault(raga_id, []).append(url)
        exported_songs.add(norm_key)
        count += 1
        print(f"Wrote {out_name} <- {song_label} ({raga_name})")

        extra = also_accept.get(norm_key, [])
        if extra:
            clip_answers[url] = {
                "song": song_label,
                "raga": raga_name,
                "aliases": extra,
            }

        if raga_id not in ragas_by_id:
            meta = _RAGA_META.get(raga_name, {})
            aliases = list(meta.get("aliases") or [])
            if raga_name != raga_id:
                aliases.append(raga_name)
            ragas_by_id[raga_id] = {
                "id": raga_id,
                "name": raga_name,
                "melakartaNum": meta.get("melakartaNum"),
                "arohanam": "",
                "avarohanam": "",
                "aliases": aliases,
            }

    return count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset-dir", type=Path, default=_DATASET)
    parser.add_argument(
        "--tonic",
        default="all",
        help="Shruti folder to export: A, F#, G, G#, or all (default)",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Remove existing WAVs for the tonic(s) being exported before writing",
    )
    parser.add_argument(
        "--fresh-all",
        action="store_true",
        help="Remove all kriti-*.wav in raga-guess/ before export",
    )
    args = parser.parse_args()

    dataset_dir = args.dataset_dir.resolve()
    map_files = _map_files(dataset_dir, args.tonic)
    if not map_files:
        print(f"No *-shruti-raga-map.json under {dataset_dir}", file=sys.stderr)
        return 1

    zip_path = _find_zip(dataset_dir)
    if not zip_path:
        print(
            f"No Carnatic_Dataset_Snippets.zip under {dataset_dir}. "
            "Download from https://data.mendeley.com/datasets/nkdm57hvw3/2",
            file=sys.stderr,
        )
        return 1

    _OUT.mkdir(parents=True, exist_ok=True)
    if args.fresh_all:
        for wav in _OUT.glob("kriti-*.wav"):
            wav.unlink()

    manifest: dict[str, list[str]] = {}
    if not args.fresh and not args.fresh_all and (_OUT / "manifest.json").is_file():
        manifest = json.loads((_OUT / "manifest.json").read_text(encoding="utf-8"))

    clip_answers: dict[str, dict] = {}
    if (_OUT / "clip-answers.json").is_file() and not args.fresh and not args.fresh_all:
        clip_answers = json.loads((_OUT / "clip-answers.json").read_text(encoding="utf-8"))

    ragas_by_id: dict[str, dict] = {}
    tonics_exported: list[str] = []
    total = 0

    with zipfile.ZipFile(zip_path, "r") as z:
        for map_path in map_files:
            tonic, _, _ = _load_map(map_path)
            tonics_exported.append(tonic)
            fresh_prefix = None
            if args.fresh or args.fresh_all:
                fresh_prefix = _TONIC_PREFIX.get(tonic)
            if args.fresh_all:
                fresh_prefix = _TONIC_PREFIX.get(tonic)
            # When re-exporting one tonic, drop its URLs from merged manifest
            if fresh_prefix and not args.fresh_all:
                prefix_token = f"/assets/raga-guess/{fresh_prefix}-"
                for raga_id in list(manifest):
                    manifest[raga_id] = [u for u in manifest[raga_id] if prefix_token not in u]
                    if not manifest[raga_id]:
                        del manifest[raga_id]
                clip_answers = {
                    u: v for u, v in clip_answers.items() if prefix_token not in u
                }

            total += _export_tonic(
                z,
                map_path,
                manifest,
                ragas_by_id,
                clip_answers,
                fresh_prefix if (args.fresh or args.fresh_all) else None,
            )

    if total == 0 and not manifest:
        print("No clips exported.", file=sys.stderr)
        return 1

    # Catalog includes every rāga listed in any shruti map (not only this run).
    ragas_by_id = {}
    for map_path in sorted(dataset_dir.glob("*-shruti-raga-map.json")):
        _, song_to_raga, _ = _load_map(map_path)
        for raga_name in song_to_raga.values():
            raga_id = _slug_id(raga_name)
            if raga_id in ragas_by_id:
                continue
            meta = _RAGA_META.get(raga_name, {})
            aliases = list(meta.get("aliases") or [])
            if raga_name != raga_id:
                aliases.append(raga_name)
            ragas_by_id[raga_id] = {
                "id": raga_id,
                "name": raga_name,
                "melakartaNum": meta.get("melakartaNum"),
                "arohanam": "",
                "avarohanam": "",
                "aliases": aliases,
            }

    (_OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (_OUT / "clip-answers.json").write_text(
        json.dumps(clip_answers, indent=2),
        encoding="utf-8",
    )
    (_OUT / "ragas.json").write_text(
        json.dumps(
            {
                "source": "kriti-samhita",
                "tonics": tonics_exported,
                "license": "CC BY 4.0",
                "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
                "datasetUrl": "https://data.mendeley.com/datasets/nkdm57hvw3/2",
                "datasetDoi": "10.17632/nkdm57hvw3.2",
                "ragas": [ragas_by_id[k] for k in sorted(ragas_by_id)],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        f"Manifest: {len(manifest)} ragas, "
        f"{sum(len(v) for v in manifest.values())} clips"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
