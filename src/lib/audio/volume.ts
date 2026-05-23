/** Minimum mic RMS before treating input as voice (matches Shiffman pitch tuner). */
export const PITCH_INPUT_RMS_GATE = 0.002;

/** RMS of time-domain samples in 0..1 range (typical mic). */
export function computeRms(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const x = buffer[i];
    sum += x * x;
  }
  return Math.sqrt(sum / buffer.length);
}

export function volumeLabel(
  rms: number,
  low = 0.012,
  high = 0.08,
): "too_soft" | "good" | "too_loud" {
  if (rms < low) return "too_soft";
  if (rms > high) return "too_loud";
  return "good";
}
