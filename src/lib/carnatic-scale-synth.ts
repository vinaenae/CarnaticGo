/**
 * Play arohanam / avarohanam as sequenced pure tones using fixed-interval Hz (training chart).
 * Token format matches app scales: Unicode subscripts — e.g. S R₂ G₂ M₁ P D₁ N₂ Ṡ
 *
 * Frequency reference (anchored Sa = 240 Hz; Ṡ octave = 480 Hz):
 * S 240 · R₁ 254 · R₂/G₁ 269 · R₃/G₂ 285 · G₃ 302 · M₁ 320 · M₂ 338.5 · P 358.5 ·
 * D₁ 380 · D₂/N₁ 402 · D₃/N₂ 426 · N₃ 451 · Ṡ 480.
 */

const SA_HZ = 240;
/** Upper octave Ṡ (double Sa per user chart example). */
const UPPER_SA_HZ = 480;

/** Canonical token → Hz (Ri 3 / Ga 2 tier from chart; N/D variants per subscript-only naming). */
const TOKEN_HZ = new Map<string, number>(
  (
    [
      ["S", SA_HZ],
      ["Ṡ", UPPER_SA_HZ],
      ["R₁", 254],
      ["R₂", 269],
      ["R₃", 285],
      ["G₁", 269],
      ["G₂", 285],
      ["G₃", 302],
      ["M₁", 320],
      ["M₂", 338.5],
      ["P", 358.5],
      ["D₁", 380],
      ["D₂", 402],
      ["D₃", 426],
      ["N₁", 402],
      ["N₂", 426],
      ["N₃", 451],
    ] as const
  ).map(([k, v]) => [k, v]),
);

const SUB_MAP: Record<string, string> = { "1": "₁", "2": "₂", "3": "₃", "₄": "₄" };

/**
 * Normalize a single swara token to keys used in TOKEN_HZ.
 */
export function canonicalizeSwaraToken(raw: string): string | null {
  let s = raw.trim().normalize("NFC");
  if (!s) return null;
  s = s.replace(/[.,]/g, "");

  if (s === "Ṡ" || s === "Ś") {
    return "Ṡ";
  }

  if ([...s].length === 1) {
    const L = s[0].toUpperCase();
    if (L === "S") return "S";
    if (L === "P") return "P";
  }

  const graphemes = [...s];
  const letter = (graphemes[0]?.toUpperCase() ?? "").normalize("NFC");
  let rest = graphemes.slice(1).join("");
  rest = rest.replace(/[123]/g, (d) => SUB_MAP[d] ?? d);

  if (letter === "S" && rest === "") return "S";
  if (letter === "P" && rest === "") return "P";

  if (!"RGMDN".includes(letter)) return null;

  const key = letter + rest;
  if (TOKEN_HZ.has(key)) return key;

  return null;
}

export function parseSwaraTokens(scaleLine: string): string[] {
  const parts = scaleLine
    .split(/[\s,]+/u)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const c = canonicalizeSwaraToken(p);
    if (c) out.push(c);
  }
  return out;
}

export function hzForSwaraToken(canonical: string): number | undefined {
  return TOKEN_HZ.get(canonical);
}

export function hzSequenceForScaleLine(scaleLine: string): number[] {
  const tokens = parseSwaraTokens(scaleLine);
  return tokens.map((t) => TOKEN_HZ.get(t)).filter((n): n is number => n != null);
}

export type PlaySwaraSequenceOptions = {
  noteMs?: number;
  gapMs?: number;
  gain?: number;
  onComplete?: () => void;
};

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (typeof window === "undefined") {
    throw new Error("AudioContext only in browser");
  }
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContext();
  }
  return sharedCtx;
}

/**
 * Schedules synth notes; returns `stop` to cancel remaining notes and release the current tone.
 */
export function playSwaraSequence(
  frequenciesHz: readonly number[],
  options: PlaySwaraSequenceOptions = {},
): () => void {
  const noteMs = options.noteMs ?? 380;
  const gapMs = options.gapMs ?? 45;
  const gain = options.gain ?? 0.12;
  const onComplete = options.onComplete;

  const ctx = getAudioContext();
  void ctx.resume();

  let cancelled = false;
  const timeoutIds: ReturnType<typeof setTimeout>[] = [];
  let currentStop: (() => void) | null = null;

  const step = (index: number) => {
    if (cancelled) {
      currentStop = null;
      return;
    }
    if (index >= frequenciesHz.length) {
      onComplete?.();
      currentStop = null;
      return;
    }
    const hz = frequenciesHz[index];
    if (hz <= 0) {
      timeoutIds.push(
        setTimeout(() => step(index + 1), noteMs + gapMs),
      );
      return;
    }

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    const t0 = ctx.currentTime;
    const dur = noteMs / 1000;
    const attack = Math.min(0.02, dur * 0.15);
    const release = Math.min(0.06, dur * 0.2);

    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, t0 + dur - release);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.01);

    currentStop = () => {
      try {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        osc.stop();
      } catch {
        /* already stopped */
      }
    };

    timeoutIds.push(
      setTimeout(() => {
        currentStop = null;
        step(index + 1);
      }, noteMs + gapMs),
    );
  };

  step(0);

  return () => {
    cancelled = true;
    for (const id of timeoutIds) clearTimeout(id);
    timeoutIds.length = 0;
    currentStop?.();
  };
}

/** Parse scale text and play; returns stop. */
export function playScaleLine(
  scaleLine: string,
  options?: PlaySwaraSequenceOptions,
): () => void {
  const seq = hzSequenceForScaleLine(scaleLine);
  if (seq.length === 0) {
    options?.onComplete?.();
    return () => {};
  }
  return playSwaraSequence(seq, options);
}
