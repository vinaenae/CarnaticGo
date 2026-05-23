import { canonicalizeSwaraToken, parseSwaraTokens } from "@/lib/carnatic-scale-synth";
import { MELAKARTA_72, melakartaByNumber } from "@/lib/melakarta72";
import { PRACTICE_RAGA_PARENT_INDEX } from "@/lib/practice-raga-parent-index";
import type { ScaleQuizRaga } from "@/lib/scale-quiz-ragas";

export type RagaJanyaKind = "melakarta" | "janya" | "unknown";

export type RagaScaleClass = "Audava" | "Shadava" | "Sampoorna";

export type RagaDisplayInfo = {
  parentMelakartaLine: string | null;
  janyaKind: RagaJanyaKind;
  janyaLine: string;
  ragaTypeLine: string | null;
};

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Pool / common spellings that name a melakarta (not its parent). */
const MELAKARTA_NAME_ALIASES: Readonly<Record<string, number>> = {
  kalyani: 65,
  mechakalyani: 65,
  mayamalavagoulai: 15,
  mayamalavagowla: 15,
  sankarabharanam: 29,
  shankarabharanam: 29,
  shankarabaranam: 29,
  natabhairavi: 20,
  harikambhoji: 28,
  kharaharapriya: 22,
};

function melakartaNumberLabel(n: number): string {
  const ordinals = [
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "6th",
    "7th",
    "8th",
    "9th",
    "10th",
    "11th",
    "12th",
    "13th",
    "14th",
    "15th",
    "16th",
    "17th",
    "18th",
    "19th",
    "20th",
    "21st",
    "22nd",
    "23rd",
  ];
  if (n >= 1 && n <= 23) return ordinals[n - 1]!;
  const v = n % 100;
  const suffix =
    v >= 11 && v <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

export function formatMelakartaParentLine(num: number, name?: string): string {
  const m = melakartaByNumber(num);
  const label = name ?? m?.name ?? `Melakarta ${num}`;
  return `${label} (${melakartaNumberLabel(num)} Melakarta)`;
}

function uniqueSwaraCount(scaleLine: string): number {
  const seen = new Set<string>();
  for (const raw of parseSwaraTokens(scaleLine)) {
    const c = canonicalizeSwaraToken(raw);
    if (!c) continue;
    seen.add(c === "Ṡ" ? "S" : c);
  }
  return seen.size;
}

function classifyScaleCount(n: number): RagaScaleClass | null {
  if (n === 5) return "Audava";
  if (n === 6) return "Shadava";
  if (n === 7) return "Sampoorna";
  return null;
}

export function ragaScaleTypeLine(arohanam: string, avarohanam: string): string | null {
  const aro = classifyScaleCount(uniqueSwaraCount(arohanam));
  const ava = classifyScaleCount(uniqueSwaraCount(avarohanam));
  if (!aro || !ava) return null;
  if (aro === ava) return aro;
  return `${aro}–${ava}`;
}

function resolveMelakartaNumber(raga: ScaleQuizRaga): number | null {
  if (raga.melakartaNum != null) return raga.melakartaNum;
  const hit = PRACTICE_RAGA_PARENT_INDEX[raga.id];
  return hit?.parentMelakartaNum ?? null;
}

function isMelakartaRaga(raga: ScaleQuizRaga, parentNum: number | null): boolean {
  const idNorm = normName(raga.id);
  const nameNorm = normName(raga.name);
  const hit = PRACTICE_RAGA_PARENT_INDEX[raga.id];
  if (hit?.isMelakarta) return true;

  const aliasNum = MELAKARTA_NAME_ALIASES[idNorm] ?? MELAKARTA_NAME_ALIASES[nameNorm];
  if (aliasNum != null) {
    return parentNum == null || parentNum === aliasNum;
  }

  for (const m of MELAKARTA_72) {
    if (normName(m.name) === idNorm || normName(m.name) === nameNorm) return true;
  }
  if (parentNum != null) {
    const m = melakartaByNumber(parentNum);
    if (m && (normName(m.name) === idNorm || normName(m.name) === nameNorm)) return true;
  }
  return false;
}

export function getRagaDisplayInfo(raga: ScaleQuizRaga): RagaDisplayInfo {
  const parentNum = resolveMelakartaNumber(raga);
  const melakarta = isMelakartaRaga(raga, parentNum);

  let janyaKind: RagaJanyaKind = "unknown";
  let janyaLine = "Parent melakarta unknown";
  let parentMelakartaLine: string | null = null;

  if (melakarta) {
    janyaKind = "melakarta";
    janyaLine = "Melakarta raga";
  } else if (parentNum != null) {
    janyaKind = "janya";
    janyaLine = "Janya raga";
    parentMelakartaLine = formatMelakartaParentLine(parentNum);
  }

  const ragaTypeLine = ragaScaleTypeLine(raga.arohanam, raga.avarohanam);

  return {
    parentMelakartaLine,
    janyaKind,
    janyaLine,
    ragaTypeLine,
  };
}
