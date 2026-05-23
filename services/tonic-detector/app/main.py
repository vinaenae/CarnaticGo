"""FastAPI — KritiSamhita tonic (shruti) detector."""

from __future__ import annotations

import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.model import ensure_model_loaded, predict_tonic_from_bytes

app = FastAPI(
    title="CarnaticGo Tonic Detector",
    description="4-class shruti classifier (F#, G, G#, A) trained on KritiSamhita.",
    version="1.0.0",
)

_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def warmup():
    if os.getenv("TONIC_DETECTOR_WARMUP", "1") != "1":
        return
    try:
        ensure_model_loaded()
    except Exception:
        pass


@app.get("/health")
def health():
    ckpt_ok = False
    try:
        ensure_model_loaded()
        ckpt_ok = True
    except Exception:
        pass
    return {
        "ok": ckpt_ok,
        "service": "tonic-detector",
        "classes": ["F#", "G", "G#", "A"],
    }


@app.post("/detect/tonic")
async def detect_tonic(file: UploadFile = File(..., description="Audio (~20s vocal clip)")):
    try:
        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="Empty audio file")
        return predict_tonic_from_bytes(raw, file.filename or "audio.wav")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
