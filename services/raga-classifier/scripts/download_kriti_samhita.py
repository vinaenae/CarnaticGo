"""Download KritiSamhita zip + CSV from Mendeley into data/kriti-samhita/."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

_DATASET_ID = "nkdm57hvw3"
_VERSION = 2
_ROOT = Path(__file__).resolve().parents[3]
_OUT = _ROOT / "data" / "kriti-samhita"


def _api_get(url: str) -> dict:
    req = Request(url, headers={"Accept": "application/json", "User-Agent": "ragify.ai/1.0"})
    with urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _download_file(file_id: str, dest: Path) -> None:
    url = f"https://data.mendeley.com/public-files/datasets/{_DATASET_ID}/files/{file_id}/file_downloaded"
    req = Request(url, headers={"User-Agent": "ragify.ai/1.0"})
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {dest.name} …")
    with urlopen(req, timeout=600) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
    print(f"Saved {dest} ({dest.stat().st_size // 1024} KB)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=_OUT)
    parser.add_argument("--skip-extract", action="store_true")
    args = parser.parse_args()
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    meta_url = (
        f"https://data.mendeley.com/public-api/datasets/"
        f"identifiers/{_DATASET_ID}/versions/{_VERSION}"
    )
    try:
        meta = _api_get(meta_url)
    except Exception as exc:
        print(f"Mendeley API failed: {exc}", file=sys.stderr)
        print(
            "Manual download: https://data.mendeley.com/datasets/nkdm57hvw3/2\n"
            f"Place Carnatic_Dataset.csv and unzip Carnatic_Dataset_Snippets.zip under {out_dir}",
            file=sys.stderr,
        )
        return 1

    files = meta.get("files") or []
    if not files:
        print("No files in dataset metadata.", file=sys.stderr)
        return 1

    for entry in files:
        name = (entry.get("filename") or entry.get("name") or "").strip()
        file_id = entry.get("id")
        if not file_id or not name:
            continue
        dest = out_dir / name
        if dest.is_file() and dest.stat().st_size > 1000:
            print(f"Skip existing {name}")
            continue
        try:
            _download_file(file_id, dest)
        except Exception as exc:
            print(f"Failed {name}: {exc}", file=sys.stderr)
            return 1

        if name.lower().endswith(".zip") and not args.skip_extract:
            extract_to = out_dir / name.replace(".zip", "")
            if not extract_to.is_dir() or not any(extract_to.rglob("*.mp3")):
                print(f"Extracting {name} …")
                with zipfile.ZipFile(dest, "r") as zf:
                    zf.extractall(out_dir)
            else:
                print(f"Already extracted under {out_dir}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
