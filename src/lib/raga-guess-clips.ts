/**
 * Audio clips for Listen & guess (KritiSamhita shruti snippets).
 *
 * Export: python services/raga-classifier/scripts/export_kriti_listen_guess.py
 * Maps: data/kriti-samhita/*-shruti-raga-map.json
 */

import {
  canonicalListenQuizRagaId,
  listenQuizRagaById,
  loadListenQuizRagas,
} from "@/lib/listen-quiz-ragas";
import { KRITI_SAMHITA } from "@/lib/kriti-attribution";
import type { QuizRaga } from "@/lib/raga-quiz-ragas";

export type GuessClipManifest = Record<string, string[]>;

export type ClipAnswerOverride = {
  song: string;
  raga: string;
  aliases: string[];
};

export const KRITI_LISTEN_EXPORT_CMD =
  "python services/raga-classifier/scripts/export_kriti_listen_guess.py";

export { KRITI_SAMHITA };

let cachedClipAnswers: Record<string, ClipAnswerOverride> | null = null;

/** Load clip manifest from public folder (client-safe). */
export async function loadGuessClipManifest(): Promise<GuessClipManifest> {
  try {
    const res = await fetch("/assets/raga-guess/manifest.json");
    if (!res.ok) return {};
    return (await res.json()) as GuessClipManifest;
  } catch {
    return {};
  }
}

export async function loadClipAnswerOverrides(): Promise<
  Record<string, ClipAnswerOverride>
> {
  if (cachedClipAnswers) return cachedClipAnswers;
  try {
    const res = await fetch("/assets/raga-guess/clip-answers.json");
    if (!res.ok) return {};
    cachedClipAnswers = (await res.json()) as Record<string, ClipAnswerOverride>;
    return cachedClipAnswers;
  } catch {
    return {};
  }
}

export function guessClipsForRaga(manifest: GuessClipManifest, ragaId: string): string[] {
  const canon = canonicalListenQuizRagaId(ragaId) ?? ragaId;
  return manifest[canon] ?? manifest[ragaId] ?? [];
}

export function pickRandomClip(
  manifest: GuessClipManifest,
  raga: QuizRaga,
): { url: string; ragaId: string } | null {
  const paths = guessClipsForRaga(manifest, raga.id);
  if (paths.length === 0) return null;
  const url = paths[Math.floor(Math.random() * paths.length)]!;
  return { url, ragaId: raga.id };
}

export function answerForClip(
  base: QuizRaga,
  clipUrl: string,
  overrides: Record<string, ClipAnswerOverride>,
): QuizRaga {
  const o = overrides[clipUrl];
  if (!o?.aliases.length) return base;
  const extra = o.aliases.filter((a) => normalizeAlias(a) !== normalizeAlias(base.name));
  if (extra.length === 0) return base;
  return { ...base, aliases: [...new Set([...base.aliases, ...extra])] };
}

function normalizeAlias(s: string) {
  return s.trim().toLowerCase();
}

export async function randomListenRound(
  manifest: GuessClipManifest,
  excludeId?: string,
): Promise<{ clipUrl: string; answer: QuizRaga } | null> {
  const [ragas, overrides] = await Promise.all([
    loadListenQuizRagas(),
    loadClipAnswerOverrides(),
  ]);
  const pool = excludeId ? ragas.filter((r) => r.id !== excludeId) : [...ragas];
  const withClips = pool.filter((r) => guessClipsForRaga(manifest, r.id).length > 0);
  if (withClips.length === 0) return null;
  const answer = withClips[Math.floor(Math.random() * withClips.length)]!;
  const pick = pickRandomClip(manifest, answer);
  if (!pick) return null;
  const resolved = listenQuizRagaById(answer.id) ?? answer;
  return {
    clipUrl: pick.url,
    answer: answerForClip(resolved, pick.url, overrides),
  };
}
