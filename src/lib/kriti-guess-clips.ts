/**
 * Match-the-tanpura quiz clips from KritiSamhita.
 * @see https://data.mendeley.com/datasets/nkdm57hvw3/2
 *
 * Export: python services/raga-classifier/scripts/export_kriti_guess_samples.py --dataset-dir data/kriti-samhita
 */

import type { KritiTonic } from "@/lib/kriti-tonic";
import {
  normalizeKritiManifest,
  type KritiManifestAttribution,
} from "@/lib/kriti-attribution";

export type KritiGuessClip = {
  id: string;
  url: string;
  tonic: KritiTonic;
  kattaiKey: string;
  songName: string;
  durationSeconds: number;
};

export type KritiGuessManifest = KritiManifestAttribution & {
  source: "kriti-samhita";
  clips: KritiGuessClip[];
};

export async function loadKritiGuessManifest(): Promise<KritiGuessManifest | null> {
  try {
    const res = await fetch("/assets/kriti-guess/manifest.json");
    if (!res.ok) return null;
    const raw = (await res.json()) as KritiGuessManifest;
    if (!raw.clips?.length) return null;
    return normalizeKritiManifest(raw);
  } catch {
    return null;
  }
}

export function pickRandomKritiRound(
  manifest: KritiGuessManifest,
  excludeId?: string,
): KritiGuessClip | null {
  const pool = excludeId
    ? manifest.clips.filter((c) => c.id !== excludeId)
    : manifest.clips;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
