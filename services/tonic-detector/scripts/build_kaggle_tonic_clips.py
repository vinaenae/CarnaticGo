"""Build pitch-labeled 20s clips from Kaggle Carnatic Song Database (YouTube)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from kaggle_carnatic_tonic import (  # noqa: E402
    KAGGLE_DATASET_REF,
    build_clips_from_kaggle_csv,
    find_kaggle_csv,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--kaggle-dir",
        type=Path,
        help="Folder with Kaggle CSV (after: kaggle datasets download -d sanjaynatesan/carnatic-song-database)",
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=None,
        help="Path to CSV (overrides --kaggle-dir search)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=_ROOT.parents[1] / "data" / "kaggle-carnatic-clips",
    )
    parser.add_argument(
        "--max-downloads",
        type=int,
        default=20,
        help="Cap YouTube downloads (0 = all ~600+ URLs, very slow)",
    )
    parser.add_argument("--min-pitch-conf", type=float, default=0.35)
    args = parser.parse_args()

    csv_path = args.csv
    if csv_path is None:
        if not args.kaggle_dir:
            print(
                "Provide --csv or --kaggle-dir. Download metadata:\n"
                "  kaggle datasets download -d sanjaynatesan/carnatic-song-database\n"
                f"  {KAGGLE_DATASET_REF}",
                file=sys.stderr,
            )
            return 1
        csv_path = find_kaggle_csv(args.kaggle_dir.resolve())
    if csv_path is None or not csv_path.is_file():
        print("Could not find Kaggle CSV with YouTube + Ragam columns.", file=sys.stderr)
        return 1

    print(f"CSV: {csv_path}")
    print(f"Output: {args.out_dir}")
    print("Requires: pip install yt-dlp librosa soundfile")
    manifest = build_clips_from_kaggle_csv(
        csv_path,
        args.out_dir.resolve(),
        max_downloads=args.max_downloads,
        min_pitch_conf=args.min_pitch_conf,
    )
    print(f"Clips written: {manifest['n_clips']} (downloads ok: {manifest['n_downloads_attempted']})")
    print(f"Manifest: {args.out_dir / 'manifest.json'}")
    return 0 if manifest["n_clips"] else 1


if __name__ == "__main__":
    sys.exit(main())
