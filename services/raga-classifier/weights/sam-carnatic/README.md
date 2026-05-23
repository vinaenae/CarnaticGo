---
license: mit
language: en
tags:
  - audio-classification
  - carnatic-music
  - raga-classification
  - indian-classical-music
datasets:
  - sarayusapa/carnatic-ragas
metrics:
  - accuracy
  - f1
pipeline_tag: audio-classification
---

# SAM-Audio: Carnatic Raga Classifier

A CNN + Segment Attention model for classifying Carnatic ragas from audio.

## Model Details

- **Architecture**: SAM-Audio (CNN mel-spectrogram encoder + latent segmentation tokens + masked segment prediction + contrastive learning)
- **Parameters**: 2.6M
- **Training data**: [sarayusapa/carnatic-ragas](https://huggingface.co/datasets/sarayusapa/carnatic-ragas) with 3x pitch-shift augmentation
- **Best validation accuracy**: 99.62%
- **Best epoch**: 17

## Supported Ragas

| ID | Raga |
|----|------|
| 0 | Amritavarshini |
| 1 | Hamsanaadam |
| 2 | Kalyani |
| 3 | Kharaharapriya |
| 4 | Mayamalavagoulai |
| 5 | Sindhubhairavi |
| 6 | Todi |
| 7 | Varali |

## Usage

```python
import torch
import librosa
from safetensors.torch import load_file

# Load model
from train import SAMAudioModel

config = json.load(open("config.json"))
model = SAMAudioModel(
    encoder_config=config["encoder"],
    num_classes=config["num_classes"],
    num_segments=config["num_segments"],
)
state_dict = load_file("model.safetensors")
model.load_state_dict(state_dict)
model.eval()

# Load audio
y, sr = librosa.load("audio.mp3", sr=16000, mono=True)
waveform = torch.from_numpy(y[:320000]).float().unsqueeze(0)

# Predict
with torch.no_grad():
    outputs = model(input_audio=waveform)
    probs = torch.softmax(outputs["raga_logits"], dim=-1)
    pred = probs.argmax(dim=-1).item()
    print(f"Predicted: {config['id2label'][str(pred)]} ({probs[0][pred]:.1%})")
```

## Training

- 3x pitch-shift augmentation (original + random up [1-4 semitones] + random down [1-4 semitones])
- Tanpura reference pitch shifts with audio, forcing the model to learn relative intervals
- BFloat16 mixed precision on RTX 4090
- Cosine annealing LR with warmup
- Early stopping with patience=5
