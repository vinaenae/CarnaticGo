/**
 * Swara frequency ratios relative to Sa (chart row 1 for the chosen shruti column).
 * Upper-octave Sa (tara Shadja) = ratio 2.
 */

import { canonicalizeSwaraToken } from "@/lib/carnatic-scale-synth";

const S1 = "\u2081";
const S2 = "\u2082";
const S3 = "\u2083";
const TARA_S = "\u1E60";

/** Canonical token → frequency ratio vs Sa. */
export const SWARA_RATIO: Readonly<Record<string, number>> = {
  S: 1,
  [`R${S1}`]: 16 / 15,
  [`R${S2}`]: 9 / 8,
  [`R${S3}`]: 6 / 5,
  [`G${S1}`]: 9 / 8,
  [`G${S2}`]: 6 / 5,
  [`G${S3}`]: 5 / 4,
  [`M${S1}`]: 4 / 3,
  [`M${S2}`]: 17 / 12,
  P: 3 / 2,
  [`D${S1}`]: 8 / 5,
  [`D${S2}`]: 5 / 3,
  [`D${S3}`]: 9 / 5,
  [`N${S1}`]: 5 / 3,
  [`N${S2}`]: 9 / 5,
  [`N${S3}`]: 15 / 8,
  [TARA_S]: 2,
};

export function ratioForSwaraToken(canonical: string): number | undefined {
  return SWARA_RATIO[canonical];
}

/** Hz for one swara at the session Sa (chart row 1 for the selected column). */
export function hzForSwaraAtSa(canonical: string, saHz: number): number | undefined {
  const ratio = SWARA_RATIO[canonical];
  if (ratio == null || !(saHz > 0)) return undefined;
  return saHz * ratio;
}

export function hzForSwaraTokenAtSa(rawToken: string, saHz: number): number | undefined {
  const c = canonicalizeSwaraToken(rawToken);
  if (!c) return undefined;
  return hzForSwaraAtSa(c, saHz);
}

/** Display order for the full ratio swara chart (no rāga selected). */
export const RATIO_SWARA_ORDER: readonly string[] = [
  "S",
  `R${S1}`,
  `R${S2}`,
  `R${S3}`,
  `G${S1}`,
  `G${S2}`,
  `G${S3}`,
  `M${S1}`,
  `M${S2}`,
  "P",
  `D${S1}`,
  `D${S2}`,
  `D${S3}`,
  `N${S1}`,
  `N${S2}`,
  `N${S3}`,
  TARA_S,
];

/**
 * Warmup tuner: 12 swarasthanas (duplicate-frequency variants omitted).
 * G₁ = R₂, R₃ = G₂, N₁ = D₂, D₃ = N₂.
 */
export const WARMUP_SWARA_ORDER: readonly string[] = [
  "S",
  `R${S1}`,
  `R${S2}`,
  `G${S2}`,
  `G${S3}`,
  `M${S1}`,
  `M${S2}`,
  "P",
  `D${S1}`,
  `D${S2}`,
  `N${S2}`,
  `N${S3}`,
  TARA_S,
];

/** Tokens omitted from the warmup chart (same Hz as the canonical partner). */
export const WARMUP_DUPLICATE_SWARAS: Readonly<Set<string>> = new Set([
  `G${S1}`,
  `R${S3}`,
  `D${S3}`,
  `N${S1}`,
]);

/** Map duplicate swaras to their swarasthana partner for pitch matching. */
export const WARMUP_SWARA_CANONICAL: Readonly<Record<string, string>> = {
  [`G${S1}`]: `R${S2}`,
  [`R${S3}`]: `G${S2}`,
  [`D${S3}`]: `N${S2}`,
  [`N${S1}`]: `D${S2}`,
};

export function canonicalWarmupSwaraToken(token: string): string {
  return WARMUP_SWARA_CANONICAL[token] ?? token;
}
