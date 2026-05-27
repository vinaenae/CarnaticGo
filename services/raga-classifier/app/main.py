"""FastAPI service — dual raga classifiers (quiz + performance)."""

from __future__ import annotations

import os
from typing import Literal

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.jeevster_pipeline import classify_quiz_from_bytes, ensure_jeevster_loaded
from app.pipeline import classify_raga_from_bytes, ensure_model_loaded

ClassificationMode = Literal["quiz", "performance"]

app = FastAPI(
    title="ragify.ai Raga Classifier",
    description="Quiz: jeevster/carnatic-raga-classifier. Performance: sarayusapa/sam-carnatic.",
    version="0.2.0",
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
    """Pre-load weights on startup (optional; first request also works)."""
    if os.getenv("RAGA_CLASSIFIER_WARMUP", "1") != "1":
        return
    default_mode = os.getenv("RAGA_DEFAULT_MODE", "quiz")
    try:
        if default_mode == "performance":
            ensure_model_loaded()
        else:
            ensure_jeevster_loaded()
    except Exception:
        pass


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "raga-classifier",
        "inferenceMode": "local_pytorch",
        "huggingFaceInferenceApi": False,
        "modes": {
            "quiz": {
                "model": "jeevster/carnatic-raga-classifier",
                "weightsDir": os.getenv("JEEVSTER_WEIGHTS_DIR", "weights/jeevster (auto)"),
                "clipSeconds": 30,
                "sampleRate": 8000,
                "classes": 150,
            },
            "performance": {
                "model": os.getenv("SAM_CARNATIC_REPO", "sarayusapa/sam-carnatic"),
                "weightsDir": os.getenv("SAM_CARNATIC_WEIGHTS_DIR", "weights/sam-carnatic (auto)"),
                "inferenceEnv": os.getenv("RAGA_INFERENCE_MODE", "readme"),
            },
        },
    }


@app.post("/classify/raga")
async def classify_raga(
    file: UploadFile = File(..., description="Audio clip (wav, webm, mp3, …)"),
    mode: ClassificationMode = Query(
        "quiz",
        description="quiz = jeevster (arohanam/avarohanam); performance = sam-carnatic",
    ),
):
    try:
        raw = await file.read()
        if mode == "performance":
            return classify_raga_from_bytes(raw)
        return classify_quiz_from_bytes(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"classification_failed:{e!s}") from e
