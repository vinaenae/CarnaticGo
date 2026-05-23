/** Pa as a perfect fifth above Sa (simple digital tanpura pair). */
const PA_RATIO = 1.5;

function connectSaPa(
  ctx: AudioContext,
  saHz: number,
  masterGain: number,
): { oscSa: OscillatorNode; oscPa: OscillatorNode; gain: GainNode } {
  const gain = ctx.createGain();
  gain.gain.value = masterGain;

  const oscSa = ctx.createOscillator();
  oscSa.type = "sine";
  oscSa.frequency.value = saHz;

  const oscPa = ctx.createOscillator();
  oscPa.type = "sine";
  oscPa.frequency.value = saHz * PA_RATIO;

  oscSa.connect(gain);
  oscPa.connect(gain);
  gain.connect(ctx.destination);

  return { oscSa, oscPa, gain };
}

/** Short Sa+Pa preview (e.g. when tapping a preset). */
export function playTanpuraChime(saHz: number, durationMs = 950) {
  const ctx = new AudioContext();
  const { oscSa, oscPa, gain } = connectSaPa(ctx, saHz, 0.0001);

  void ctx.resume().then(() => {
    const t0 = ctx.currentTime;
    const t1 = t0 + 0.06;
    const t2 = t0 + durationMs / 1000;
    gain.gain.cancelScheduledValues(t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.1, t1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t2);
    oscSa.start(t0);
    oscPa.start(t0);
    oscSa.stop(t2 + 0.05);
    oscPa.stop(t2 + 0.05);
    window.setTimeout(() => void ctx.close(), durationMs + 300);
  });
}

/** Continuous Sa+Pa drone; call returned `stop` before closing context elsewhere. */
export function startTanpuraDrone(ctx: AudioContext, saHz: number, masterGain = 0.1) {
  const { oscSa, oscPa, gain } = connectSaPa(ctx, saHz, masterGain);
  void ctx.resume().then(() => {
    oscSa.start();
    oscPa.start();
  });
  return () => {
    try {
      oscSa.stop();
      oscPa.stop();
    } catch {
      /* already stopped */
    }
    gain.disconnect();
  };
}
