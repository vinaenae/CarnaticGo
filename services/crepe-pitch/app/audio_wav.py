"""Decode uploaded WAV bytes for CREPE."""

from __future__ import annotations

import io

import numpy as np
from fastapi import HTTPException, UploadFile
from scipy.io import wavfile

MAX_BYTES = 48 * 1024 * 1024


async def read_wav_upload(file: UploadFile) -> tuple[np.ndarray, float]:
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "Audio file too large (max 48 MB).")
    if len(raw) < 44:
        raise HTTPException(400, "Empty or invalid WAV.")

    try:
        sr, data = wavfile.read(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(400, f"Could not read WAV: {exc}") from exc

    if data.ndim > 1:
        data = data.mean(axis=1)

    if data.dtype == np.int16:
        audio = data.astype(np.float64) / 32768.0
    elif data.dtype == np.int32:
        audio = data.astype(np.float64) / 2147483648.0
    elif data.dtype == np.uint8:
        audio = (data.astype(np.float64) - 128.0) / 128.0
    else:
        audio = data.astype(np.float64)

    sr_f = float(sr)
    if audio.size < 512:
        raise HTTPException(400, "Audio too short for pitch analysis.")
    return audio, sr_f


def contour_payload(audio: np.ndarray, sr_f: float) -> dict:
    from app.crepe_contour import extract_pitch_contour

    times_sec, hz = extract_pitch_contour(audio, sr_f)
    voiced_frames = sum(1 for h in hz if h is not None)
    return {
        "sampleRate": sr_f,
        "timesSec": times_sec,
        "hz": hz,
        "voicedFrames": voiced_frames,
        "engine": "crepe",
    }
