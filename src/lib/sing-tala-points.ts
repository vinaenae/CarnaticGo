import { PITCH_INPUT_RMS_GATE } from "@/lib/audio/volume";

export const SING_TALA_ACTIVE_GOAL_MS = 15 * 60 * 1000;
export const SING_TALA_SILENCE_PAUSE_MS = 7_000;
export const SING_TALA_BONUS_POINTS = 5;

/** Singing detected — needs mic level plus a pitch, not room noise alone. */
export function isSingTalaVoiceActive(inputRms: number, freqHz: number): boolean {
  return inputRms >= PITCH_INPUT_RMS_GATE && freqHz > 0;
}
export function formatSingTalaTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatSingTalaGoal(): string {
  return formatSingTalaTimer(SING_TALA_ACTIVE_GOAL_MS);
}
