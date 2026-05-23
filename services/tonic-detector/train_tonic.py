"""
Train a 4-class KritiSamhita tonic classifier (log-mel + small CNN).

Usage:
  python train_tonic.py --dataset-dir ../../data/kriti-samhita
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import librosa
import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GroupShuffleSplit
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

TONICS = ["F#", "G", "G#", "A"]
LABEL_MAP = {t: i for i, t in enumerate(TONICS)}
_ROOT = Path(__file__).resolve().parent


def _load_index(
    dataset_dir: Path,
    supplement_dir: Path | None = None,
    kaggle_clips_dir: Path | None = None,
):
    from kriti_tonic_index import build_rows  # noqa: WPS433

    return build_rows(
        dataset_dir,
        extra_snippets_dir=supplement_dir,
        kaggle_clips_dir=kaggle_clips_dir,
    )


class MelDataset(Dataset):
    def __init__(self, rows, sr: int = 22050, n_mels: int = 128, seconds: float = 20.0):
        self.rows = rows
        self.sr = sr
        self.n_mels = n_mels
        self.frames = int(seconds * sr / 512)

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx: int):
        row = self.rows[idx]
        y, _ = librosa.load(row["path"], sr=self.sr, mono=True)
        mel = librosa.feature.melspectrogram(y=y, sr=self.sr, n_mels=self.n_mels)
        mel_db = librosa.power_to_db(mel, ref=np.max)
        if mel_db.shape[1] < self.frames:
            pad = self.frames - mel_db.shape[1]
            mel_db = np.pad(mel_db, ((0, 0), (0, pad)), mode="constant")
        else:
            mel_db = mel_db[:, : self.frames]
        x = torch.tensor(mel_db, dtype=torch.float32).unsqueeze(0)
        y_t = torch.tensor(row["label"], dtype=torch.long)
        return x, y_t


class SmallTonicCNN(nn.Module):
    def __init__(self, n_classes: int = 4):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((4, 4)),
            nn.Flatten(),
            nn.Linear(64 * 4 * 4, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, n_classes),
        )

    def forward(self, x):
        return self.net(x)


def _evaluate(model, loader, device):
    model.eval()
    preds, gold = [], []
    with torch.no_grad():
        for xb, yb in loader:
            xb = xb.to(device)
            pred = model(xb).argmax(dim=1).cpu().numpy()
            preds.extend(pred.tolist())
            gold.extend(yb.numpy().tolist())
    acc = accuracy_score(gold, preds)
    macro_f1 = f1_score(gold, preds, average="macro", zero_division=0)
    return acc, macro_f1, gold, preds


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-dir", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--out-dir", type=Path, default=_ROOT / "checkpoints")
    parser.add_argument("--patience", type=int, default=6, help="Early stop if val macro-F1 stalls")
    parser.add_argument(
        "--supplement-dir",
        type=Path,
        default=None,
        help="Optional extra KritiSamhita snippets+CSV (same layout)",
    )
    parser.add_argument(
        "--kaggle-clips-dir",
        type=Path,
        default=None,
        help="Optional pitch-labeled clips from build_kaggle_tonic_clips.py",
    )
    args = parser.parse_args()

    rows = _load_index(
        args.dataset_dir.resolve(),
        args.supplement_dir,
        args.kaggle_clips_dir,
    )
    if len(rows) < 40:
        print("Need KritiSamhita under --dataset-dir (see README.md).", file=sys.stderr)
        return 1

    groups = [r["group"] for r in rows]
    labels = [r["label"] for r in rows]
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, val_idx = next(splitter.split(np.zeros(len(rows)), labels, groups))

    train_rows = [rows[i] for i in train_idx]
    val_rows = [rows[i] for i in val_idx]
    print(f"Samples: {len(rows)} | train {len(train_rows)} | val {len(val_rows)} (grouped by song+tonic)")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    model = SmallTonicCNN().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    crit = nn.CrossEntropyLoss()

    train_loader = DataLoader(
        MelDataset(train_rows),
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
    )
    val_loader = DataLoader(MelDataset(val_rows), batch_size=args.batch_size, num_workers=0)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    best_f1 = -1.0
    best_epoch = 0
    stale = 0
    history: list[dict] = []

    for epoch in range(1, args.epochs + 1):
        model.train()
        loss_sum = 0.0
        for xb, yb in tqdm(train_loader, desc=f"epoch {epoch}", leave=False):
            xb, yb = xb.to(device), yb.to(device)
            opt.zero_grad()
            logits = model(xb)
            loss = crit(logits, yb)
            loss.backward()
            opt.step()
            loss_sum += loss.item()

        val_acc, val_f1, gold, preds = _evaluate(model, val_loader, device)
        train_loss = loss_sum / max(len(train_loader), 1)
        history.append(
            {"epoch": epoch, "train_loss": train_loss, "val_accuracy": val_acc, "val_macro_f1": val_f1}
        )
        print(
            f"epoch {epoch} loss={train_loss:.4f} val_acc={val_acc:.3f} val_macro_f1={val_f1:.3f}"
        )

        if val_f1 > best_f1:
            best_f1 = val_f1
            best_epoch = epoch
            stale = 0
            ckpt = args.out_dir / "tonic_cnn.pt"
            torch.save(
                {
                    "state_dict": model.state_dict(),
                    "tonics": TONICS,
                    "label_map": LABEL_MAP,
                    "epoch": epoch,
                    "val_accuracy": val_acc,
                    "val_macro_f1": val_f1,
                },
                ckpt,
            )
        else:
            stale += 1
            if stale >= args.patience:
                print(f"Early stop at epoch {epoch} (best epoch {best_epoch}, macro-F1 {best_f1:.3f})")
                break

    # Final report on best checkpoint
    best_ckpt = torch.load(args.out_dir / "tonic_cnn.pt", map_location=device, weights_only=False)
    model.load_state_dict(best_ckpt["state_dict"])
    val_acc, val_f1, gold, preds = _evaluate(model, val_loader, device)

    report = classification_report(gold, preds, target_names=TONICS, zero_division=0)
    cm = confusion_matrix(gold, preds).tolist()

    (args.out_dir / "label_map.json").write_text(
        json.dumps({"tonics": TONICS, "label_map": LABEL_MAP}, indent=2),
        encoding="utf-8",
    )
    training_report = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_dir": str(args.dataset_dir.resolve()),
        "n_samples": len(rows),
        "n_train": len(train_rows),
        "n_val": len(val_rows),
        "best_epoch": best_epoch,
        "val_accuracy": val_acc,
        "val_macro_f1": val_f1,
        "confusion_matrix": cm,
        "classification_report": report,
        "history": history,
        "device": str(device),
    }
    (args.out_dir / "training_report.json").write_text(
        json.dumps(training_report, indent=2),
        encoding="utf-8",
    )

    print("\nBest model (epoch", best_epoch, ")")
    print(report)
    print("Confusion matrix:\n", np.array(cm))
    print("Saved", args.out_dir / "tonic_cnn.pt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
