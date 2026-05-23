"""Write training_manifest.json from full KritiSamhita CSV (all ~1027 clips)."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from kriti_tonic_index import TONICS, build_rows  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=_ROOT.parents[1] / "data" / "kriti-samhita",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=_ROOT / "data" / "training_manifest.json",
    )
    parser.add_argument(
        "--supplement-dir",
        type=Path,
        default=None,
        help="Optional extra folder with same CSV/snippet layout",
    )
    args = parser.parse_args()

    rows = build_rows(
        args.dataset_dir,
        extra_snippets_dir=args.supplement_dir,
    )
    if len(rows) < 100:
        print(
            "Too few samples. Unzip Carnatic_Dataset_Snippets.zip and place "
            "Carnatic_Dataset.csv next to it.",
            file=sys.stderr,
        )
        return 1

    manifest = {
        "tonics": TONICS,
        "n_samples": len(rows),
        "per_tonic": dict(Counter(r["tonic"] for r in rows)),
        "per_source": dict(Counter(r["source"] for r in rows)),
        "samples": [
            {
                "path": str(r["path"]),
                "tonic": r["tonic"],
                "label": r["label"],
                "group": r["group"],
                "song": r["song"],
                "source": r["source"],
            }
            for r in rows
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {args.out} ({len(rows)} samples)")
    print("Per tonic:", manifest["per_tonic"])
    print("Per source:", manifest["per_source"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
