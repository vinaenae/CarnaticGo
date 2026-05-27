"""FastAPI service — Carnatic vocal rhythm alignment (no swara/raga)."""

from __future__ import annotations

import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.pipeline import analyze_rhythm_segment

app = FastAPI(
    title="ragify.ai Rhythm Analysis",
    description="Librosa-backed onset + beat alignment to a fixed tala/BPM reference.",
    version="0.1.0",
)

_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": "rhythm-analysis"}


@app.post("/analyze/rhythm")
async def analyze_rhythm(
    file: UploadFile = File(..., description="Audio segment (wav, webm, mp3, …)"),
    bpm: float = Form(..., ge=20, le=400, description="Metronome BPM (same as practice session)"),
    tala: str = Form("adi", description="Fixed tala id; only 'adi' supported in MVP"),
):
    """
    Process a short practice clip: vocal onsets vs expected beat grid (Adi = 8 beats per cycle at BPM).
    """
    try:
        raw = await file.read()
        if len(raw) < 256:
            raise HTTPException(status_code=400, detail="audio_too_short")
        out = analyze_rhythm_segment(raw, bpm=bpm, tala=tala.lower())
        return out
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"analysis_failed:{e!s}") from e
