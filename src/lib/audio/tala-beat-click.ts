import type { TalaGesture } from "@/lib/carnatic-tala";

/** Short percussive cue when a tāla hand/finger gesture lands (each kāla syllable). */
export function playTalaLandClick(ctx: AudioContext, gesture: TalaGesture) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (gesture === "clap") {
    osc.type = "square";
    osc.frequency.setValueAtTime(920, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.11, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    osc.start(t);
    osc.stop(t + 0.06);
    return;
  }

  if (gesture === "count") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(380, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.075, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.start(t);
    osc.stop(t + 0.055);
    return;
  }

  /* wave — softer open-palm */
  osc.type = "triangle";
  osc.frequency.setValueAtTime(520, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.start(t);
  osc.stop(t + 0.075);
}
