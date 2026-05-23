/**
 * Ragas for Listen & guess — loaded from KritiSamhita export (ragas.json).
 */

import { normalizeRagaKey, type QuizRaga } from "@/lib/raga-quiz-ragas";

export type ListenQuizCatalog = {
  source: "kriti-samhita";
  tonic?: string;
  tonics?: string[];
  license: string;
  licenseUrl?: string;
  datasetUrl: string;
  datasetDoi?: string;
  ragas: QuizRaga[];
};

let cachedRagas: QuizRaga[] | null = null;
let aliasToId: Map<string, string> | null = null;

function buildAliasMap(ragas: QuizRaga[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of ragas) {
    map.set(normalizeRagaKey(r.id), r.id);
    map.set(normalizeRagaKey(r.name), r.id);
    for (const a of r.aliases) map.set(normalizeRagaKey(a), r.id);
  }
  return map;
}

export async function loadListenQuizRagas(): Promise<QuizRaga[]> {
  if (cachedRagas) return cachedRagas;
  try {
    const res = await fetch("/assets/raga-guess/ragas.json");
    if (!res.ok) return [];
    const raw = (await res.json()) as ListenQuizCatalog;
    const ragas = Array.isArray(raw.ragas) ? raw.ragas : [];
    cachedRagas = ragas;
    aliasToId = buildAliasMap(ragas);
    return ragas;
  } catch {
    return [];
  }
}

export function canonicalListenQuizRagaId(label: string): string | null {
  return aliasToId?.get(normalizeRagaKey(label)) ?? null;
}

export function listenQuizRagaById(id: string): QuizRaga | undefined {
  const canon = canonicalListenQuizRagaId(id);
  return cachedRagas?.find((r) => r.id === (canon ?? id));
}
