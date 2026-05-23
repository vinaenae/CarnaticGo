"""Resolve local or Hub paths for sarayusapa/sam-carnatic assets."""

from __future__ import annotations

import json
import os
from pathlib import Path

from huggingface_hub import hf_hub_download

HF_REPO = os.getenv("SAM_CARNATIC_REPO", "sarayusapa/sam-carnatic")
_DEFAULT_WEIGHTS = Path(__file__).resolve().parents[1] / "weights" / "sam-carnatic"


def weights_dir() -> Path | None:
    raw = os.getenv("SAM_CARNATIC_WEIGHTS_DIR", "").strip()
    if raw:
        p = Path(raw)
        return p if p.is_dir() else None
    if _DEFAULT_WEIGHTS.is_dir() and (_DEFAULT_WEIGHTS / "config.json").exists():
        return _DEFAULT_WEIGHTS
    return None


def asset_path(filename: str) -> str:
    """Local weights file if present, else download from Hugging Face Hub."""
    local = weights_dir()
    if local is not None:
        candidate = local / filename
        if candidate.is_file():
            return str(candidate)
    return hf_hub_download(repo_id=HF_REPO, filename=filename)


def load_json_asset(filename: str) -> dict:
    return json.loads(Path(asset_path(filename)).read_text(encoding="utf-8"))
