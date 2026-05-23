/**
 * Signed ms from the **nearest** metronome pulse using **phase** (no `round` jump at half-beat).
 * Positive = after the click (late in the beat); negative = before the next click (early).
 * Varies smoothly as `audioTimeSeconds` advances.
 */
export function continuousBeatOffsetMs(params: {
  audioTimeSeconds: number;
  sessionStartAudioSeconds: number;
  bpm: number;
}): number {
  const beatSec = 60 / params.bpm;
  const elapsed = params.audioTimeSeconds - params.sessionStartAudioSeconds;
  if (!Number.isFinite(elapsed) || beatSec <= 0) {
    return 0;
  }
  const phase = ((elapsed % beatSec) + beatSec) % beatSec;
  const half = beatSec / 2;
  const offsetSec = phase <= half ? phase : phase - beatSec;
  return offsetSec * 1000;
}

/** Legacy: nearest beat via rounding — can flip ±half period; prefer `continuousBeatOffsetMs` for live UI. */
export function nearestBeatOffsetMs(params: {
  audioTimeSeconds: number;
  sessionStartAudioSeconds: number;
  bpm: number;
}): { offsetMs: number; ahead: boolean } {
  const beatSec = 60 / params.bpm;
  const elapsed = params.audioTimeSeconds - params.sessionStartAudioSeconds;
  if (!Number.isFinite(elapsed) || beatSec <= 0) {
    return { offsetMs: 0, ahead: false };
  }
  const k = Math.round(elapsed / beatSec);
  const nearestBeat = params.sessionStartAudioSeconds + k * beatSec;
  const offsetSec = params.audioTimeSeconds - nearestBeat;
  const offsetMs = offsetSec * 1000;
  return { offsetMs, ahead: offsetMs < 0 };
}
