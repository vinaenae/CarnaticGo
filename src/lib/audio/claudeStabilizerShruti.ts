export function computeRms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i]! * buf[i]!;
  return Math.sqrt(s / buf.length);
}

/** FFT peak in Hz for octave hint (analyser must have frequency data). */
export function fftPeakHz(analyser: AnalyserNode, sampleRate: number): number {
  const fftSize = analyser.frequencyBinCount;
  const fdata = new Float32Array(fftSize);
  analyser.getFloatFrequencyData(fdata);
  const binHz = sampleRate / (fftSize * 2);
  const lo = Math.floor(80 / binHz);
  const hi = Math.min(fftSize - 1, Math.ceil(1400 / binHz));
  let bestBin = lo;
  let bestVal = -Infinity;
  for (let i = lo; i <= hi; i++) {
    if (fdata[i]! > bestVal) {
      bestVal = fdata[i]!;
      bestBin = i;
    }
  }
  if (bestVal < -80) return -1;
  return bestBin * binHz;
}

/** Sub-harmonic fix: prefer vocal-range Hz using FFT cross-check. */
export function correctVocalOctave(yinHz: number, analyser: AnalyserNode, sampleRate: number): number {
  if (yinHz <= 0) return -1;
  const fft = fftPeakHz(analyser, sampleRate);
  const doubled = yinHz * 2;

  if (doubled >= 130 && doubled <= 900 && fft > 0) {
    const distOrig = Math.abs(Math.log2(fft / yinHz));
    const distDouble = Math.abs(Math.log2(fft / doubled));
    if (distDouble < distOrig) return doubled;
  }
  if (yinHz >= 130 && yinHz <= 900) return yinHz;
  if (yinHz < 130 && doubled >= 130 && doubled <= 900) return doubled;
  return yinHz;
}
