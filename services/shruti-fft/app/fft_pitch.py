"""Pitch from microphone frames via Hann-windowed RFFT peak (training-chart vocal range)."""

from __future__ import annotations

import numpy as np

MIN_HZ = 65.0
MAX_HZ = 2000.0
RMS_GATE = 0.0025


def frame_rms(samples: np.ndarray) -> float:
    if samples.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))


def estimate_pitch_hz(samples: np.ndarray, sample_rate: float) -> tuple[float | None, float]:
    """
    Returns (hz, confidence 0..1). `None` when unvoiced / too quiet.
    """
    x = np.asarray(samples, dtype=np.float64)
    if x.size < 256 or sample_rate <= 0:
        return None, 0.0

    rms = frame_rms(x)
    if rms < RMS_GATE:
        return None, 0.0

    n = int(2 ** np.ceil(np.log2(max(512, x.size))))
    if x.size < n:
        x = np.pad(x, (0, n - x.size))

    window = np.hanning(x.size)
    spec = np.abs(np.fft.rfft(x * window))
    freqs = np.fft.rfftfreq(x.size, d=1.0 / sample_rate)

    mask = (freqs >= MIN_HZ) & (freqs <= MAX_HZ)
    if not np.any(mask):
        return None, 0.0

    sub_spec = spec[mask]
    sub_freqs = freqs[mask]
    peak_i = int(np.argmax(sub_spec))
    peak_mag = float(sub_spec[peak_i])
    total = float(np.sum(sub_spec)) + 1e-12
    confidence = min(1.0, peak_mag / total * 4.0)

    # Parabolic interpolation around peak
    if 0 < peak_i < len(sub_spec) - 1:
        alpha, beta, gamma = sub_spec[peak_i - 1], sub_spec[peak_i], sub_spec[peak_i + 1]
        denom = alpha - 2 * beta + gamma
        if abs(denom) > 1e-12:
            shift = 0.5 * (alpha - gamma) / denom
            hz = float(sub_freqs[peak_i] + shift * (sub_freqs[1] - sub_freqs[0]))
        else:
            hz = float(sub_freqs[peak_i])
    else:
        hz = float(sub_freqs[peak_i])

    if not np.isfinite(hz) or hz < MIN_HZ or hz > MAX_HZ:
        return None, 0.0

    return hz, confidence
