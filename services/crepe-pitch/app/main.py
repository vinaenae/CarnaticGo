"""FastAPI — CREPE pitch contours for sing-with-teacher charts."""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np

from app.audio_wav import contour_payload, read_wav_upload
from app.crepe_contour import MODEL_CAPACITY, STEP_MS, estimate_live_frame_hz

app = FastAPI(
    title="ragacoach CREPE pitch",
    description="CREPE F0 extraction for sing-along frequency charts.",
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


class AnalyzeFrameBody(BaseModel):
    samples: list[float] = Field(..., min_length=512, max_length=65536)
    sample_rate: float = Field(..., gt=0, le=192_000)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "crepe-pitch",
        "stepMs": STEP_MS,
        "modelCapacity": MODEL_CAPACITY,
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict[str, Any]:
    audio, sr_f = await read_wav_upload(file)
    return contour_payload(audio, sr_f)


@app.post("/analyze/batch")
async def analyze_batch(
    ref: UploadFile | None = File(default=None),
    user: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    """
    Analyze one or two clips in a single request (sequential CREPE passes).
    Matches marl/crepe per-file predict; avoids parallel TensorFlow jobs contending.
    """
    items: list[tuple[str, UploadFile]] = []
    if ref is not None and ref.filename:
        items.append(("ref", ref))
    if user is not None and user.filename:
        items.append(("user", user))
    if not items:
        raise HTTPException(400, "Provide at least one of: ref, user WAV uploads.")

    results: dict[str, Any] = {}
    for key, upload in items:
        audio, sr_f = await read_wav_upload(upload)
        results[key] = contour_payload(audio, sr_f)

    return {"engine": "crepe", "results": results}


@app.post("/analyze/frame")
def analyze_frame(body: AnalyzeFrameBody) -> dict[str, Any]:
    arr = np.asarray(body.samples, dtype=np.float64)
    hz, confidence = estimate_live_frame_hz(arr, body.sample_rate)
    if hz is None:
        return {"voiced": False, "confidence": confidence, "engine": "crepe"}
    return {
        "voiced": True,
        "hz": hz,
        "confidence": confidence,
        "engine": "crepe",
    }
