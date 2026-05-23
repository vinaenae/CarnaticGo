/**
 * KritiSamhita tonic bins (F#–A) mapped to app tanpura keys.
 * @see https://data.mendeley.com/datasets/nkdm57hvw3/2
 */

export const KRITI_TONIC_CLASSES = [
  {
    tonic: "F#",
    kattai: "4.5",
    kattaiKey: "kattai_4_5",
    label: "F♯ — 4½ kattai",
    shortLabel: "F♯",
  },
  {
    tonic: "G",
    kattai: "5",
    kattaiKey: "kattai_5",
    label: "G — 5 kattai",
    shortLabel: "G",
  },
  {
    tonic: "G#",
    kattai: "5.5",
    kattaiKey: "kattai_5_5",
    label: "G♯ — 5½ kattai",
    shortLabel: "G♯",
  },
  {
    tonic: "A",
    kattai: "6",
    kattaiKey: "kattai_6",
    label: "A — 6 kattai",
    shortLabel: "A",
  },
] as const;

export type KritiTonic = (typeof KRITI_TONIC_CLASSES)[number]["tonic"];

export type KritiKattaiKey = (typeof KRITI_TONIC_CLASSES)[number]["kattaiKey"];

const TONIC_BY_KEY = new Map<KritiKattaiKey, KritiTonic>(
  KRITI_TONIC_CLASSES.map((c) => [c.kattaiKey, c.tonic]),
);

export const KRITI_KATTAI_KEYS: readonly KritiKattaiKey[] = KRITI_TONIC_CLASSES.map(
  (c) => c.kattaiKey,
);

export function isKritiKattaiKey(key: string): key is KritiKattaiKey {
  return (KRITI_KATTAI_KEYS as readonly string[]).includes(key);
}

const CLASS_BY_TONIC = new Map(
  KRITI_TONIC_CLASSES.map((c) => [c.tonic, c] as const),
);

export function kritiClassForTonic(tonic: KritiTonic) {
  return CLASS_BY_TONIC.get(tonic)!;
}

export function kritiClassForTanpuraKey(kattaiKey: string) {
  if (!isKritiKattaiKey(kattaiKey)) return null;
  return kritiClassForTonic(TONIC_BY_KEY.get(kattaiKey)!);
}

/** Parse CSV annotation like `F# Scale (4.5 Kattai)` or folder name `G#`. */
export function parseKritiTonicLabel(raw: string): KritiTonic | null {
  const s = raw.trim();
  if (!s) return null;
  const head = (s.split(/\s+Scale/i)[0]?.trim() ?? s).replace("♯", "#").replace("♭", "b");
  // Longer labels first so G# is not matched as G.
  const order: KritiTonic[] = ["G#", "F#", "G", "A"];
  const upper = head.toUpperCase();
  for (const tonic of order) {
    const t = tonic.toUpperCase();
    if (upper === t || upper.startsWith(`${t} `) || upper.startsWith(`${t}(`)) {
      return tonic;
    }
  }
  if (head.includes("#")) {
    const m = head.match(/([A-G])#/i);
    if (m) {
      const t = `${m[1]!.toUpperCase()}#` as KritiTonic;
      if (CLASS_BY_TONIC.has(t)) return t;
    }
  }
  return null;
}

export function shuffleKritiChoices<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
