export type ClickStyle = "click" | "wood" | "soft";

export class MetronomeScheduler {
  private ctx: AudioContext | null = null;
  private nextBeatTime = 0;
  private beatInterval = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private style: ClickStyle = "click";

  start(
    audioContext: AudioContext,
    bpm: number,
    startOffsetSeconds = 0,
    style: ClickStyle = "click",
  ) {
    this.stop();
    this.ctx = audioContext;
    this.style = style;
    this.beatInterval = 60 / bpm;
    const now = audioContext.currentTime;
    this.nextBeatTime = now + startOffsetSeconds;
    this.running = true;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  private schedule() {
    const audioContext = this.ctx;
    if (!audioContext || !this.running) return;
    const lookahead = 0.12;
    while (this.nextBeatTime < audioContext.currentTime + lookahead) {
      this.playClick(this.nextBeatTime);
      this.nextBeatTime += this.beatInterval;
    }
  }

  private playClick(when: number) {
    const audioContext = this.ctx;
    if (!audioContext) return;

    if (this.style === "wood") {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "sine";
      osc.frequency.value = 180;
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.14, when + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(when);
      osc.stop(when + 0.08);
      return;
    }

    if (this.style === "soft") {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "triangle";
      osc.frequency.value = 660;
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.045, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(when);
      osc.stop(when + 0.1);
      return;
    }

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "square";
    osc.frequency.value = 1000;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.09, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(when);
    osc.stop(when + 0.06);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
