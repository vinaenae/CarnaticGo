# Shruti FFT (rāga swara detector)

Python service: **Hann-windowed RFFT** on mic frames → nearest swara from the **fixed training-chart Hz** (`S` 240 Hz … `Ṡ` 480 Hz) for each rāga in `scale-quiz-scale-overrides`.

## Setup

From repo root, generate the rāga note list (once, or after scale edits):

```bash
node scripts/generate-raga-swara-notes.mjs
```

```bash
cd services/shruti-fft
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8002
```

In `.env.local`:

```env
SHRUTI_FFT_URL=http://127.0.0.1:8002
```

The practice live page proxies `POST /api/shruti-fft/analyze` → `{SHRUTI_FFT_URL}/analyze/frame`.

## Standalone mic (no browser)

```bash
python scripts/live_mic.py
python scripts/live_mic.py --raga Mohanam
python scripts/live_mic.py --list-devices   # if you add device listing later
```

## API

- `GET /health`
- `GET /ragas` — ids + swara counts
- `GET /ragas/{id}/swaras`
- `POST /analyze/frame` — JSON `{ samples, sample_rate, raga_id?, sa_hz?, cents_limit? }`
