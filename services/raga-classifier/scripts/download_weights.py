#!/usr/bin/env python3
"""Download all sarayusapa/sam-carnatic files from Hugging Face into weights/."""

from __future__ import annotations

import json
from pathlib import Path

from huggingface_hub import hf_hub_download

REPO = "sarayusapa/sam-carnatic"
FILES = [
    "config.json",
    "preprocessor_config.json",
    "model.safetensors",
    "best_model.pth",
    "README.md",
]

ROOT = Path(__file__).resolve().parents[1]
WEIGHTS_DIR = ROOT / "weights" / "sam-carnatic"


def main() -> None:
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, str] = {}
    for name in FILES:
        print(f"Downloading {name}...")
        path = hf_hub_download(repo_id=REPO, filename=name, local_dir=str(WEIGHTS_DIR))
        dest = WEIGHTS_DIR / name
        if Path(path).resolve() != dest.resolve():
            import shutil
            shutil.copy2(path, dest)
        manifest[name] = str(dest)
        size_mb = dest.stat().st_size / (1024 * 1024)
        print(f"  -> {dest} ({size_mb:.2f} MB)")

    (WEIGHTS_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nDone. Set in .env.local:\nSAM_CARNATIC_WEIGHTS_DIR={WEIGHTS_DIR}")


if __name__ == "__main__":
    main()
