/**
 * YIN pitch (aubio-derived) with explicit periodicity confidence.
 * pitchfinder's build only returns Hz; we expose probability for downstream filtering.
 */

export type YinFrameResult = {
  hz: number;
  /** ~0..1, higher = more periodic / confident (1 − CMND at chosen τ). */
  probability: number;
};

export type YinFrameConfig = {
  sampleRate: number;
  threshold: number;
  probabilityThreshold: number;
};

const DEFAULTS: YinFrameConfig = {
  sampleRate: 44100,
  threshold: 0.12,
  probabilityThreshold: 0.11,
};

/**
 * Returns null when unvoiced or low-confidence.
 */
export function createYinFrameDetector(config: Partial<YinFrameConfig> = {}) {
  const { sampleRate, threshold, probabilityThreshold } = { ...DEFAULTS, ...config };

  return function detectYinFrame(float32AudioBuffer: Float32Array): YinFrameResult | null {
    let bufferSize = 1;
    while (bufferSize < float32AudioBuffer.length) bufferSize *= 2;
    bufferSize /= 2;

    const yinBufferLength = bufferSize / 2;
    const yinBuffer = new Float32Array(yinBufferLength);

    for (let t = 0; t < yinBufferLength; t++) yinBuffer[t] = 0;
    for (let t = 1; t < yinBufferLength; t++) {
      let acc = 0;
      for (let i = 0; i < yinBufferLength; i++) {
        const delta = float32AudioBuffer[i] - float32AudioBuffer[i + t];
        acc += delta * delta;
      }
      yinBuffer[t] = acc;
    }

    yinBuffer[0] = 1;
    yinBuffer[1] = 1;
    let runningSum = 0;
    for (let t = 1; t < yinBufferLength; t++) {
      runningSum += yinBuffer[t];
      yinBuffer[t] *= t / runningSum;
    }

    let tau = 2;
    let probability = 0;
    for (; tau < yinBufferLength; tau++) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < yinBufferLength && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
        probability = 1 - yinBuffer[tau];
        break;
      }
    }

    if (tau === yinBufferLength || yinBuffer[tau] >= threshold) return null;
    if (probability < probabilityThreshold) return null;

    let x0: number;
    if (tau < 1) x0 = tau;
    else x0 = tau - 1;
    let x2: number;
    if (tau + 1 < yinBufferLength) x2 = tau + 1;
    else x2 = tau;

    let betterTau: number;
    if (x0 === tau) {
      betterTau = yinBuffer[tau] <= yinBuffer[x2] ? tau : x2;
    } else if (x2 === tau) {
      betterTau = yinBuffer[tau] <= yinBuffer[x0] ? tau : x0;
    } else {
      const s0 = yinBuffer[x0];
      const s1 = yinBuffer[tau];
      const s2 = yinBuffer[x2];
      betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    const hz = sampleRate / betterTau;
    if (!Number.isFinite(hz) || hz < 50 || hz > 2500) return null;
    return { hz, probability };
  };
}
