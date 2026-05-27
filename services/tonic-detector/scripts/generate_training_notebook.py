"""Regenerate KritiSamhita_Tonic_Training.ipynb (original scratch-training version)."""

from __future__ import annotations

import json
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
cells: list[dict] = []


def md(s: str) -> None:
    cells.append(
        {"cell_type": "markdown", "metadata": {}, "source": [line + "\n" for line in s.split("\n")]}
    )


def code(s: str) -> None:
    cells.append(
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [line + "\n" for line in s.split("\n")],
        }
    )


md(
    """# KritiSamhita tonic detector — train from scratch (Colab)

Trains a **new** 4-class shruti classifier (F♯, G, G♯, A). **No pre-trained weights are loaded.**

| | |
|---|---|
| **You need** | This `.ipynb` + **`Carnatic_Dataset_Snippets.zip`** from [Mendeley](https://data.mendeley.com/datasets/nkdm57hvw3/2) |
| **You do *not* need** | `tonic_cnn.pt`, `label_map.json`, `training_report.json`, or `Carnatic_Dataset.csv` |
| **You get after training** | *New* checkpoint files to download (optional — for deploying in ragify.ai) |

**Dataset license:** CC BY 4.0 · [Paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11286976/)

### Steps
1. **Runtime → Change runtime type → GPU**
2. Upload **`Carnatic_Dataset_Snippets.zip`** to Colab (sidebar → Files → Upload), **not** old checkpoints
3. Run all cells top to bottom
4. (Optional) Download the three **output** files from the last cell"""
)

code("!pip -q install librosa soundfile scikit-learn tqdm")

md("## 1. Dataset zip only (edit path if needed)")

code(
    """from pathlib import Path
import shutil
import zipfile

# Upload Carnatic_Dataset_Snippets.zip to /content/ (Colab file browser)
DATASET_ZIP = Path("/content/Carnatic_Dataset_Snippets.zip")

# Or Google Drive:
# from google.colab import drive
# drive.mount("/content/drive")
# DATASET_ZIP = Path("/content/drive/MyDrive/Carnatic_Dataset_Snippets.zip")

WORK_DIR = Path("/content/kriti-samhita")
SNIPPETS_ROOT = WORK_DIR / "Carnatic_Dataset_Snippets"

# Fresh output folder every run (never load old weights from here)
OUT_DIR = Path("/content/tonic_checkpoints_fresh")
if OUT_DIR.exists():
    shutil.rmtree(OUT_DIR)
OUT_DIR.mkdir(parents=True)

LOAD_EXISTING_CHECKPOINT = False  # must stay False for scratch training

if not DATASET_ZIP.is_file():
    raise FileNotFoundError(
        "Upload Carnatic_Dataset_Snippets.zip from Mendeley to /content/\\n"
        "https://data.mendeley.com/datasets/nkdm57hvw3/2"
    )

if not SNIPPETS_ROOT.is_dir() or not any(SNIPPETS_ROOT.rglob("*.mp3")):
    print("Extracting dataset zip…")
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(DATASET_ZIP, "r") as zf:
        zf.extractall(WORK_DIR)

n_mp3 = len(list(SNIPPETS_ROOT.rglob("*.mp3")))
print(f"Snippets: {SNIPPETS_ROOT}")
print(f"MP3 files: {n_mp3}")
print(f"Output (new weights only): {OUT_DIR}")
print(f"LOAD_EXISTING_CHECKPOINT = {LOAD_EXISTING_CHECKPOINT}")
assert n_mp3 >= 100, "Expected ~1027 MP3s — check zip\""""
)

md("## 2. Index clips (validation split by song, not by chunk)")

code(
    """import re

TONICS = ["F#", "G", "G#", "A"]
LABEL_MAP = {t: i for i, t in enumerate(TONICS)}
KATTAI = {"F#": "4.5", "G": "5", "G#": "5.5", "A": "6"}


def parse_tonic(text: str) -> str | None:
    head = text.strip().replace("♯", "#").replace("♭", "b")
    for tonic in ("G#", "F#", "G", "A"):
        t = tonic.upper()
        h = head.upper()
        if h == t or h.startswith(f"{t} ") or h.startswith(f"{t}("):
            return tonic
    m = re.search(r"_([A-G]#?)_chunk", head, re.I)
    if m and m.group(1).upper() in LABEL_MAP:
        return m.group(1).upper()
    if m and m.group(1).upper().endswith("#"):
        cand = m.group(1).upper()[0] + "#"
        if cand in LABEL_MAP:
            return cand
    return None


def song_group(path: Path) -> str:
    m = re.match(r"^(.+?)_[A-G]#?_chunk\\d+$", path.stem, re.I)
    return (m.group(1) if m else path.stem).lower()


rows = []
for mp3 in sorted(SNIPPETS_ROOT.rglob("*.mp3")):
    tonic = parse_tonic(mp3.parent.name) or parse_tonic(mp3.name)
    if not tonic:
        continue
    rows.append(
        {
            "path": mp3,
            "tonic": tonic,
            "label": LABEL_MAP[tonic],
            "group": f"{song_group(mp3)}_{tonic}",
        }
    )

from collections import Counter
print(f"Indexed {len(rows)} clips")
print(dict(Counter(r["tonic"] for r in rows)))"""
)

md("## 3. Model + features (random initialization — scratch)")

code(
    """import librosa
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

SR = 22050
N_MELS = 128
CLIP_SECONDS = 20.0
MEL_FRAMES = int(CLIP_SECONDS * SR / 512)


class MelDataset(Dataset):
    def __init__(self, data_rows):
        self.rows = data_rows

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx: int):
        row = self.rows[idx]
        y, _ = librosa.load(row["path"], sr=SR, mono=True)
        mel = librosa.feature.melspectrogram(y=y, sr=SR, n_mels=N_MELS)
        mel_db = librosa.power_to_db(mel, ref=np.max)
        if mel_db.shape[1] < MEL_FRAMES:
            mel_db = np.pad(mel_db, ((0, 0), (0, MEL_FRAMES - mel_db.shape[1])), mode="constant")
        else:
            mel_db = mel_db[:, :MEL_FRAMES]
        x = torch.tensor(mel_db, dtype=torch.float32).unsqueeze(0)
        return x, torch.tensor(row["label"], dtype=torch.long)


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


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Device:", device)

# --- Scratch only: new model, no torch.load ---
assert not LOAD_EXISTING_CHECKPOINT, "Set LOAD_EXISTING_CHECKPOINT=False"
model = SmallTonicCNN().to(device)
print("Model initialized from scratch (random weights).")"""
)

md("## 4. Train (writes new checkpoints to `OUT_DIR` only)")

code(
    """import json
from datetime import datetime, timezone

from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GroupShuffleSplit
from tqdm.auto import tqdm

EPOCHS = 30
BATCH_SIZE = 32
LR = 1e-3
PATIENCE = 6

groups = [r["group"] for r in rows]
labels = [r["label"] for r in rows]
train_idx, val_idx = next(
    GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42).split(
        np.zeros(len(rows)), labels, groups
    )
)
train_rows = [rows[i] for i in train_idx]
val_rows = [rows[i] for i in val_idx]
print(f"Train {len(train_rows)} | Val {len(val_rows)}")

train_loader = DataLoader(MelDataset(train_rows), batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
val_loader = DataLoader(MelDataset(val_rows), batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

opt = torch.optim.Adam(model.parameters(), lr=LR)
crit = nn.CrossEntropyLoss()


def evaluate(loader):
    model.eval()
    preds, gold = [], []
    with torch.no_grad():
        for xb, yb in loader:
            pred = model(xb.to(device)).argmax(dim=1).cpu().numpy()
            preds.extend(pred.tolist())
            gold.extend(yb.numpy().tolist())
    return accuracy_score(gold, preds), f1_score(gold, preds, average="macro", zero_division=0), gold, preds


best_f1, best_epoch, stale = -1.0, 0, 0
history = []

for epoch in range(1, EPOCHS + 1):
    model.train()
    loss_sum = 0.0
    for xb, yb in tqdm(train_loader, desc=f"Epoch {epoch}", leave=False):
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad()
        loss = crit(model(xb), yb)
        loss.backward()
        opt.step()
        loss_sum += loss.item()

    val_acc, val_f1, gold, preds = evaluate(val_loader)
    train_loss = loss_sum / max(len(train_loader), 1)
    history.append({"epoch": epoch, "train_loss": train_loss, "val_accuracy": val_acc, "val_macro_f1": val_f1})
    print(f"Epoch {epoch}: loss={train_loss:.4f} val_acc={val_acc:.3f} val_macro_f1={val_f1:.3f}")

    if val_f1 > best_f1:
        best_f1, best_epoch, stale = val_f1, epoch, 0
        torch.save(
            {
                "state_dict": model.state_dict(),
                "tonics": TONICS,
                "label_map": LABEL_MAP,
                "kattai": KATTAI,
                "sr": SR,
                "n_mels": N_MELS,
                "mel_frames": MEL_FRAMES,
                "trained_from_scratch": True,
                "epoch": epoch,
                "val_accuracy": val_acc,
                "val_macro_f1": val_f1,
            },
            OUT_DIR / "tonic_cnn.pt",
        )
    else:
        stale += 1
        if stale >= PATIENCE:
            print(f"Early stop at epoch {epoch} (best {best_epoch}, F1 {best_f1:.3f})")
            break

# Load only the best weights from *this* run (for reporting — not a pre-uploaded file)
best_ckpt = torch.load(OUT_DIR / "tonic_cnn.pt", map_location=device)
model.load_state_dict(best_ckpt["state_dict"])
val_acc, val_f1, gold, preds = evaluate(val_loader)
report = classification_report(gold, preds, target_names=TONICS, zero_division=0)
cm = confusion_matrix(gold, preds).tolist()
print("\\n=== Trained from scratch — best epoch", best_epoch, "===")
print(report)
print("Confusion matrix:\\n", np.array(cm))

(OUT_DIR / "label_map.json").write_text(
    json.dumps({"tonics": TONICS, "label_map": LABEL_MAP, "kattai": KATTAI}, indent=2)
)
(OUT_DIR / "training_report.json").write_text(
    json.dumps(
        {
            "trained_from_scratch": True,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "best_epoch": best_epoch,
            "val_accuracy": val_acc,
            "val_macro_f1": val_f1,
            "confusion_matrix": cm,
            "classification_report": report,
            "history": history,
            "device": str(device),
            "dataset": "https://doi.org/10.17632/nkdm57hvw3.2",
        },
        indent=2,
    )
)
print("Saved new checkpoints to", OUT_DIR)"""
)

md("## 5. Quick test on one clip")

code(
    """import torch.nn.functional as F

sample = val_rows[0]
xb, _ = MelDataset([sample])[0]
with torch.no_grad():
    probs = F.softmax(model(xb.unsqueeze(0).to(device)), dim=1).cpu().numpy()[0]
i = int(probs.argmax())
print("File:", sample["path"].name)
print("True tonic:", sample["tonic"])
print("Predicted:", TONICS[i], f"({probs[i]:.2f})")"""
)

md("## 6. Download **new** outputs (optional)")

code(
    """from google.colab import files

for name in ["tonic_cnn.pt", "label_map.json", "training_report.json"]:
    p = OUT_DIR / name
    if not p.is_file():
        print("Missing (run training cell first):", p)
        continue
    print("Downloading", name, "…")
    files.download(str(p))

print("\\nOptional: copy into services/tonic-detector/checkpoints/ in your repo.")"""
)

nb = {
    "nbformat": 4,
    "nbformat_minor": 5,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
        "colab": {"provenance": []},
    },
    "cells": cells,
}

out = _ROOT / "KritiSamhita_Tonic_Training.ipynb"
out.write_text(json.dumps(nb, indent=1), encoding="utf-8")
print(f"Wrote {out} ({len(cells)} cells)")
