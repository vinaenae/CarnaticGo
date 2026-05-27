# Raga classifier service

Dual models:

| Mode | Model | Use |
|------|--------|-----|
| `quiz` (default) | [jeevster/carnatic-raga-classifier](https://huggingface.co/spaces/jeevster/carnatic-raga-classifier) | Offline clip export / local experiments (~30 s, 150 ragas) |
| `performance` | [sarayusapa/sam-carnatic](https://huggingface.co/sarayusapa/sam-carnatic) | Concert / performance clips (8 ragas) |

## Setup

```bash
cd services/raga-classifier
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Download weights once:

```bash
python scripts/download_jeevster_weights.py   # quiz (~70 MB)
python scripts/download_weights.py            # performance (~40 MB)
```

Run (Windows PowerShell):

```powershell
$env:JEEVSTER_WEIGHTS_DIR="$PWD\weights\jeevster"
$env:SAM_CARNATIC_WEIGHTS_DIR="$PWD\weights\sam-carnatic"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

API: `POST /classify/raga?mode=quiz` or `?mode=performance`.

## Run

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

The ragify.ai web app no longer calls this service at runtime. Use it for `scripts/export_*.py` or manual API tests.

## Supported ragas

Amritavarshini, Hamsanaadam, Kalyani, Kharaharapriya, Mayamalavagoulai, Sindhubhairavi, Todi, Varali.

## Reference

**Default inference** matches the [Hugging Face model card](https://huggingface.co/sarayusapa/sam-carnatic) Python snippet:

```python
y, sr = librosa.load(..., sr=16000, mono=True)
waveform = torch.from_numpy(y[:320000]).float().unsqueeze(0)  # truncate only — do not zero-pad short clips
outputs = model(input_audio=waveform)
probs = torch.softmax(outputs["raga_logits"], dim=-1)
```

Weights: `model.safetensors` (fallback `best_model.pth`). Short quiz recordings (~10–18 s) must **not** be padded to 20 s with silence — that was a common cause of wrong labels (e.g. always Mayamalavagowla).

Set `RAGA_INFERENCE_MODE=dual_path` for the longer [inference/inference.py](https://github.com/sarayusapa/sam-carnatic/blob/main/inference/inference.py) pipeline:


1. Load mono 16 kHz audio  
2. **Path 2:** detect Sa on original audio (20 s chunks, zero-padded)  
3. Pitch-normalize so Sa → 261.63 Hz  
4. **Path 1:** classify raga on normalized audio  

Weights: `best_model.pth` (`model_state_dict`) from Hugging Face, fallback `model.safetensors`.

The quiz records 16 kHz mono WAV (optional tanpura mix checkbox; off by default). After changing Python code or weights, **restart uvicorn**.

Sanity check on training audio:

```bash
python scripts/test_dataset_accuracy.py
```
