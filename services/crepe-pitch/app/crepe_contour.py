"""CREPE F0 track → time / Hz series for sing-along charts."""

from __future__ import annotations

import os

import numpy as np

CONFIDENCE_GATE = 0.36
HZ_MIN = 55.0
HZ_MAX = 2000.0
# CREPE step_size is in milliseconds (10 ms ≈ 100 Hz frame rate).
STEP_MS = 10
# Override with CREPE_MODEL_CAPACITY (tiny/small/large) if needed.
MODEL_CAPACITY = os.getenv("CREPE_MODEL_CAPACITY", "medium")
# Live tuner: smaller model, coarser steps, no Viterbi — much lower latency than batch charts.
LIVE_MODEL_CAPACITY = os.getenv("CREPE_LIVE_MODEL", "tiny")
LIVE_STEP_MS = 20
LIVE_MAX_INPUT_SEC = 0.22


def extract_pitch_contour(
    audio: np.ndarray,
    sample_rate: float,
    *,
    model_capacity: str = MODEL_CAPACITY,
) -> tuple[list[float], list[float | None]]:
    import crepe

    mono = np.asarray(audio, dtype=np.float64).reshape(-1)
    if mono.size < 512:
        return [], []

    peak = float(np.max(np.abs(mono)))
    if peak > 1e-8 and peak < 0.25:
        mono = mono * min(0.92 / peak, 12.0)

    _time, frequency, confidence, _activation = crepe.predict(
        mono.astype(np.float32),
        sample_rate,
        step_size=STEP_MS,
        model_capacity=model_capacity,
        viterbi=True,
        verbose=0,
    )

    times = _time.astype(np.float64)
    freq = frequency.astype(np.float64)
    conf = confidence.astype(np.float64)

    hz_out: list[float | None] = []
    for f, c in zip(freq, conf):
        if c >= CONFIDENCE_GATE and HZ_MIN < f < HZ_MAX:
            hz_out.append(float(f))
        else:
            hz_out.append(None)

    return times.tolist(), hz_out


def _resample_to_16k(mono: np.ndarray, sample_rate: float) -> np.ndarray:
    if abs(sample_rate - 16000.0) < 1.0:
        return mono
    from scipy import signal

    out_len = max(512, int(round(mono.size * 16000.0 / sample_rate)))
    return signal.resample(mono, out_len).astype(np.float64)


def estimate_live_frame_hz(
    audio: np.ndarray,
    sample_rate: float,
    *,
    model_capacity: str = LIVE_MODEL_CAPACITY,
) -> tuple[float | None, float]:
    """Single fast CREPE pass on a short mic buffer for the live warmup tuner."""
    import crepe

    mono = np.asarray(audio, dtype=np.float64).reshape(-1)
    if mono.size < 512:
        return None, 0.0

    sr_in = float(sample_rate)
    max_samples = max(512, int(sr_in * LIVE_MAX_INPUT_SEC))
    if mono.size > max_samples:
        mono = mono[-max_samples:]

    peak = float(np.max(np.abs(mono)))
    if peak > 1e-8 and peak < 0.25:
        mono = mono * min(0.92 / peak, 12.0)

    sr = 16000.0
    mono16 = _resample_to_16k(mono, sr_in)

    _time, frequency, confidence, _activation = crepe.predict(
        mono16.astype(np.float32),
        sr,
        step_size=LIVE_STEP_MS,
        model_capacity=model_capacity,
        viterbi=False,
        verbose=0,
    )

    freq = frequency.astype(np.float64)
    conf = confidence.astype(np.float64)
    voiced: list[tuple[float, float]] = []
    live_gate = min(CONFIDENCE_GATE, 0.28)
    for f, c in zip(freq, conf):
        if c >= live_gate and HZ_MIN < f < HZ_MAX:
            voiced.append((float(f), float(c)))

    if not voiced:
        return None, float(np.mean(conf)) if conf.size else 0.0

    freqs = np.array([f for f, _ in voiced], dtype=np.float64)
    weights = np.array([c for _, c in voiced], dtype=np.float64)
    hz = float(np.average(freqs, weights=weights))
    prob = float(np.clip(np.mean(weights), 0.0, 1.0))
    return hz, prob
