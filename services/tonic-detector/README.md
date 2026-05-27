# Tonic (shruti) detector

Train a **4-class tonic classifier** on [KritiSamhita](https://data.mendeley.com/datasets/nkdm57hvw3/2) (F♯, G, G♯, A). The dataset authors used representation-learning approaches for tonic detection ([Data in Brief paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11286976/); see also their [segmentation code](https://github.com/Sam-Kon/KritiSamhita_SouthICMAudioDataset_Code)).

## Task definition

- **Input:** ~20 s monophonic Carnatic vocal audio (with drone in the recording).
- **Output:** one of `{F#, G, G#, A}` (kattai 4½–6).
- **Not the same as:** full 12-key Western key, rāga ID, or live pitch of an arbitrary recording without normalization.

## Data layout

1. Download `Carnatic_Dataset_Snippets.zip` + `Carnatic_Dataset.csv` from Mendeley.
2. Unzip under `data/kriti-samhita/` (gitignored).
3. Export quiz assets (optional):  
   `python services/raga-classifier/scripts/export_kriti_guess_samples.py --dataset-dir data/kriti-samhita`

For training, read **MP3 paths from the CSV** directly; do not leak chunks from the same song across train/val.

## Train / validation split (important)

Snippets from one kriti share the same vocalist, drone, and recording. **Split by song name**, not by file:

```text
Raravenu_F#_chunk0.mp3 … Raravenu_F#_chunk13.mp3  →  one group
```

Use **group k-fold** or hold out ~20% of unique `{songName, tonic}` groups. Random chunk splits inflate accuracy.

## Baseline pipeline (start here)

1. **Resample** to 22 050 Hz mono (matches KritiSamhita export script).
2. **Features** (pick one stack to baseline):
   - **Chroma / CQT** (12 or 36 bins) → mean + std over time → logistic regression or small MLP.
   - **Harmonic pitch class profile (HPCP)** via librosa — classic for tonic in ICM ([Gulati et al., JNMR 2014](https://doi.org/10.1080/09298215.2013.870611)).
   - **CREPE / pYIN** pitch track → histogram of pitch classes folded to one octave → argmax bin mapped to nearest tonic class.
3. **Classifier:** `sklearn.linear_model.LogisticRegression` or 2–3 layer MLP in PyTorch.
4. **Metrics:** accuracy, macro-F1, confusion matrix (expect G vs G♯ confusion).

Run locally:

```bash
cd services/tonic-detector
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python train_tonic.py --dataset-dir ../../data/kriti-samhita --epochs 30
```

Or use **Google Colab** (GPU): open [`KritiSamhita_Tonic_Training.ipynb`](./KritiSamhita_Tonic_Training.ipynb), upload `Carnatic_Dataset_Snippets.zip`, run all cells, download checkpoints into `checkpoints/`.

Artifacts: `checkpoints/tonic_cnn.pt`, `label_map.json`.

## Stronger model (recommended next step)

Follow the paper’s direction: **learned representations** on raw audio or spectrograms.

| Approach | Notes |
|----------|--------|
| **CNN on log-mel** | 128 mel bands × time → ResNet-18 / small EfficientNet; input 20 s → crop/pad to fixed length. |
| **Pretrained audio encoder** | PANNs, YAMNet, or `torchaudio` wav2vec2 fine-tuned on KritiSamhita. |
| **Pitch salience + head** | CREPE salience maps → 1D CNN; good when drone is present. |

Training tips:

- **Class weights** if you use all 1 027 clips (F♯:300, G:207, G♯:240, A:280).
- **SpecAugment** (time/freq mask) on mel inputs.
- **Label smoothing** 0.05 for 4-way softmax.
- Early stopping on **validation macro-F1**, not train loss.

## Serving in ragify.ai

1. Export ONNX or TorchScript from `train_tonic.py --export-onnx`.
2. Add FastAPI route under `services/tonic-detector/app.py` (mirror `services/raga-classifier`).
3. Call from Next.js `/api/tonic/detect` for:
   - mic upload after practice,
   - auto-suggest shruti dropdown,
   - future “sing Sa and we detect your tonic” mode.

**Caveat:** KritiSamhita is **two female vocalists, 4 tonics only**. A model trained only on it will not generalize to all concert pitches or voice types until you add more data (user opt-in, licensed concerts, etc.).

## License

KritiSamhita is **CC BY 4.0**. You may train commercial models if you attribute the dataset in docs and in-app notices (`public/NOTICES.md`).
