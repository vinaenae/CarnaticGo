"""Download jeevster/carnatic-raga-classifier Space assets for quiz inference."""

from __future__ import annotations

from pathlib import Path

from huggingface_hub import hf_hub_download

REPO = "jeevster/carnatic-raga-classifier"
REPO_TYPE = "space"

FILES = [
    "config.yaml",
    "metadata_0.7.json",
    "labeled_0.7_wav_metadata.json",
    "ckpts/resnet_0.7/150classes_alldata_cliplength30/training_checkpoints/best_ckpt.tar",
    "inference.py",
    "models/RagaNet.py",
    "data/dataloader.py",
    "utils/YParams.py",
    "utils/logging_utils.py",
]


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "weights" / "jeevster"
    root.mkdir(parents=True, exist_ok=True)
    code_root = Path(__file__).resolve().parents[1] / "vendor" / "jeevster"
    code_root.mkdir(parents=True, exist_ok=True)

    for filename in FILES:
        print(f"Downloading {filename}...")
        path = hf_hub_download(repo_id=REPO, filename=filename, repo_type=REPO_TYPE)
        src = Path(path)
        if filename.endswith(".py") or filename.startswith(("models/", "data/", "utils/")):
            dest = code_root / filename
        else:
            dest = root / filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        content = src.read_bytes()
        dest.write_bytes(content)
        if filename == "inference.py":
            text = dest.read_text(encoding="utf-8")
            old = "torch.load(checkpoint_path, map_location=self.device)"
            new = "torch.load(checkpoint_path, map_location=self.device, weights_only=False)"
            if old in text and new not in text:
                dest.write_text(text.replace(old, new), encoding="utf-8")
        size_mb = dest.stat().st_size / (1024 * 1024)
        print(f"  -> {dest} ({size_mb:.2f} MB)")

    print(f"\nDone.\n  Weights: {root}\n  Code:    {code_root}")
    print(f"Set JEEVSTER_WEIGHTS_DIR={root}")


if __name__ == "__main__":
    main()
