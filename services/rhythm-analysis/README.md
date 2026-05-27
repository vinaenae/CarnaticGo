# Rhythm analysis service (librosa + FastAPI)

ragify.ai **vocal timing** helper: onset detection and alignment to a **fixed** metronome BPM and **Adi** tala frame (8 beats per avartanam at the same click rate as the in-app metronome). No automatic tala detection, no swara/raga.

## Setup

```bash
cd services/rhythm-analysis
python -m venv .venv
.\.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Set in ragify.ai `.env.local`:

```env
RHYTHM_ANALYSIS_URL=http://127.0.0.1:8000
```

## API

- `GET /health` — liveness.
- `POST /analyze/rhythm` — `multipart/form-data`:
  - `file`: audio blob (wav/webm/mp3, …)
  - `bpm`: number (20–400), must match the practice session metronome.
  - `tala`: optional, default `adi` (only `adi` supported).

### JSON response (camelCase)

```json
{
  "averageTimingOffsetMs": 12.4,
  "rhythmStabilityScore": 78.2,
  "beatAlignmentScore": 81.0,
  "detectedOnsets": [0.12, 0.45, 0.78],
  "confidence": 0.72,
  "beatPeriodSec": 0.8333,
  "cycleBeats": 8,
  "gridPhaseSec": 0.041
}
```

- **averageTimingOffsetMs**: mean |onset − nearest beat| after best phase fit.
- **rhythmStabilityScore** / **beatAlignmentScore**: 0–100 heuristics (tighter / steadier → higher).
- **detectedOnsets**: seconds, analysis sample rate (default 22050 Hz pipeline).
- **gridPhaseSec**: best phase in `[0, beatPeriod)` aligning the grid to detected onsets (no client anchor in MVP).

## CORS

`CORS_ORIGINS` env (comma-separated) defaults to `http://localhost:3000`. Prefer calling via Next.js proxy `POST /api/rhythm/analyze` so the browser does not need CORS in production.

## Future

Streaming chunks, mridangam/clap tracks, explicit beat-0 anchor from the client, more talas — keep `ingestion` / `onsets` / `tala_grid` / `alignment` / `scoring` split.

### Machine learning

Practice **live** timing uses classical **spectral-flux + energy** onset cues in the browser (same family as librosa’s `onset_strength`, without a trained neural net). **Neural onset** or **transformer beat trackers** could replace or augment `onset_detect` later if you need polyphonic/noisy environments; for solo vocal + metronome, librosa-style DSP is usually the first stop before ML.
