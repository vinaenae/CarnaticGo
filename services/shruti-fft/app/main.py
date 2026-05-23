"""FastAPI — FFT pitch frames from browser mic or standalone script."""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.fft_pitch import estimate_pitch_hz
from app.swara_map import fold_to_chart_octave, list_ragas, nearest_swara, swaras_for_raga

app = FastAPI(
    title="ragacoach Shruti FFT",
    description="RFFT pitch → swara tokens from scale-quiz chart Hz per rāga.",
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
    samples: list[float] = Field(..., min_length=64, max_length=65536)
    sample_rate: float = Field(..., gt=0, le=192_000)
    raga_id: str | None = Field(None, description="Scale-quiz rāga id; omit for full chart")
    sa_hz: float = Field(240.0, gt=0)
    cents_limit: float = Field(85.0, gt=0, le=200)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "shruti-fft", "ragas": len(list_ragas())}


@app.get("/ragas")
def ragas() -> dict[str, Any]:
    return {"ragas": [{"id": r["id"], "name": r["name"], "swaraCount": len(r["swaras"])} for r in list_ragas()]}


@app.get("/ragas/{raga_id}/swaras")
def raga_swaras(raga_id: str) -> dict[str, Any]:
    sw = swaras_for_raga(raga_id)
    if not sw:
        raise HTTPException(404, f"Unknown raga or no swaras: {raga_id}")
    return {"id": raga_id, "swaras": sw}


@app.post("/analyze/frame")
def analyze_frame(body: AnalyzeFrameBody) -> dict[str, Any]:
    import numpy as np

    arr = np.asarray(body.samples, dtype=np.float64)
    hz_raw, confidence = estimate_pitch_hz(arr, body.sample_rate)
    if hz_raw is None:
        return {"voiced": False, "confidence": confidence}

    hz_folded = fold_to_chart_octave(hz_raw, body.sa_hz)
    allowed = swaras_for_raga(body.raga_id)
    hit = nearest_swara(hz_folded, allowed, body.cents_limit)

    return {
        "voiced": True,
        "hz": hz_raw,
        "hzFolded": hz_folded,
        "confidence": confidence,
        "token": hit.token if hit else None,
        "chartHz": hit.hz if hit else None,
        "centsOff": hit.cents_off if hit else None,
        "inRaga": bool(hit),
        "ragaId": body.raga_id,
    }
