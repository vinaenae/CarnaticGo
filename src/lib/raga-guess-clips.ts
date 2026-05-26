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

export type ManifestClip = {
  url: string;
  ragaId: string;
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

/** Song slug shared across shruti folders (e.g. raravenu, kamala-sanavam). */
export function clipSongSlug(clipUrl: string): string {
  const file = clipUrl.split("/").pop() ?? "";
  return file.replace(/^kriti-[a-z0-9#]+-/i, "").replace(/\.wav$/i, "");
}

export function listManifestClips(manifest: GuessClipManifest): ManifestClip[] {
  const clips: ManifestClip[] = [];
  for (const [ragaId, urls] of Object.entries(manifest)) {
    for (const url of urls) {
      clips.push({ url, ragaId });
    }
  }
  return clips;
}

export function buildSongSlugIndex(
  manifest: GuessClipManifest,
): Map<string, ManifestClip[]> {
  const index = new Map<string, ManifestClip[]>();
  for (const clip of listManifestClips(manifest)) {
    const slug = clipSongSlug(clip.url);
    const list = index.get(slug) ?? [];
    list.push(clip);
    index.set(slug, list);
  }
  return index;
}

export function guessClipsForRaga(manifest: GuessClipManifest, ragaId: string): string[] {
  const canon = canonicalListenQuizRagaId(ragaId) ?? ragaId;
  return manifest[canon] ?? manifest[ragaId] ?? [];
}

function ragaById(ragas: QuizRaga[], ragaId: string): QuizRaga | undefined {
  const canon = canonicalListenQuizRagaId(ragaId) ?? ragaId;
  return listenQuizRagaById(canon) ?? ragas.find((r) => r.id === canon);
}

function fallbackRaga(ragaId: string): QuizRaga {
  return {
    id: ragaId,
    name: ragaId,
    melakartaNum: null,
    arohanam: "",
    avarohanam: "",
    aliases: [],
  };
}

function addRagaLabels(aliases: Set<string>, raga: QuizRaga) {
  aliases.add(raga.name);
  for (const a of raga.aliases) aliases.add(a);
}

/**
 * Resolve the scored answer for one clip URL.
 * Primary label = manifest bucket for this recording; aliases include map alsoAccept
 * and other rāga labels used for the same song at different shrutis.
 */
export function resolveListenClipAnswer(
  clipUrl: string,
  manifestRagaId: string,
  manifest: GuessClipManifest,
  overrides: Record<string, ClipAnswerOverride>,
  ragas: QuizRaga[],
  songIndex: Map<string, ManifestClip[]>,
): QuizRaga {
  const base = ragaById(ragas, manifestRagaId) ?? fallbackRaga(manifestRagaId);
  const accepted = new Set<string>();
  addRagaLabels(accepted, base);

  const override = overrides[clipUrl];
  if (override) {
    const primary = ragaById(ragas, override.raga);
    if (primary) addRagaLabels(accepted, primary);
    else accepted.add(override.raga);
    for (const alias of override.aliases) accepted.add(alias);
  }

  const slug = clipSongSlug(clipUrl);
  for (const variant of songIndex.get(slug) ?? []) {
    if (variant.ragaId === manifestRagaId) continue;
    const other = ragaById(ragas, variant.ragaId);
    if (other) addRagaLabels(accepted, other);
  }

  accepted.delete(base.name);
  return {
    ...base,
    aliases: [...accepted],
  };
}

/** @deprecated Use {@link resolveListenClipAnswer}. */
export function answerForClip(
  base: QuizRaga,
  clipUrl: string,
  overrides: Record<string, ClipAnswerOverride>,
  manifest: GuessClipManifest,
  ragas: QuizRaga[],
): QuizRaga {
  const songIndex = buildSongSlugIndex(manifest);
  const bucket =
    listManifestClips(manifest).find((c) => c.url === clipUrl)?.ragaId ?? base.id;
  return resolveListenClipAnswer(clipUrl, bucket, manifest, overrides, ragas, songIndex);
}

export async function randomListenRound(
  manifest: GuessClipManifest,
  excludeClipUrl?: string,
): Promise<{ clipUrl: string; answer: QuizRaga; song?: string } | null> {
  const [ragas, overrides] = await Promise.all([
    loadListenQuizRagas(),
    loadClipAnswerOverrides(),
  ]);
  const songIndex = buildSongSlugIndex(manifest);
  let clips = listManifestClips(manifest);
  if (excludeClipUrl) {
    clips = clips.filter((c) => c.url !== excludeClipUrl);
  }
  if (clips.length === 0) return null;

  const pick = clips[Math.floor(Math.random() * clips.length)]!;
  const answer = resolveListenClipAnswer(
    pick.url,
    pick.ragaId,
    manifest,
    overrides,
    ragas,
    songIndex,
  );

  return {
    clipUrl: pick.url,
    answer,
    song: overrides[pick.url]?.song,
  };
}
