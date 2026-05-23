/**
 * Ragas supported by sarayusapa/sam-carnatic (8 classes).
 * @see https://huggingface.co/sarayusapa/sam-carnatic
 */
export type QuizRaga = {
  /** Canonical model label */
  id: string;
  name: string;
  melakartaNum: number | null;
  arohanam: string;
  avarohanam: string;
  aliases: string[];
};

export const QUIZ_RAGAS: readonly QuizRaga[] = [
  {
    id: "Amritavarshini",
    name: "Amritavarshini",
    melakartaNum: 53,
    arohanam: "S R₂ G₃ M₂ P D₂ N₃ Ṡ",
    avarohanam: "Ṡ N₃ D₂ P M₂ G₃ R₂ S",
    aliases: ["Amrithavarshini"],
  },
  {
    id: "Hamsanaadam",
    name: "Hamsanadam",
    melakartaNum: null,
    arohanam: "S G₃ M₂ P N₃ Ṡ",
    avarohanam: "Ṡ N₃ P M₂ G₃ S",
    aliases: ["Hamsanadam"],
  },
  {
    id: "Kalyani",
    name: "Kalyani",
    melakartaNum: 65,
    arohanam: "S R₂ G₃ M₂ P D₂ N₃ Ṡ",
    avarohanam: "Ṡ N₃ D₂ P M₂ G₃ R₂ S",
    aliases: ["Mechakalyani"],
  },
  {
    id: "Kharaharapriya",
    name: "Kharaharapriya",
    melakartaNum: 22,
    arohanam: "S R₂ G₂ M₁ P D₁ N₂ Ṡ",
    avarohanam: "Ṡ N₂ D₁ P M₁ G₂ R₂ S",
    aliases: [],
  },
  {
    id: "Mayamalavagoulai",
    name: "Mayamalavagowla",
    melakartaNum: 15,
    arohanam: "S R₁ G₃ M₁ P D₁ N₃ Ṡ",
    avarohanam: "Ṡ N₃ D₁ P M₁ G₃ R₁ S",
    aliases: ["Mayamalavagowla"],
  },
  {
    id: "Sindhubhairavi",
    name: "Sindhubhairavi",
    melakartaNum: 10,
    arohanam: "S R₁ G₂ M₁ P N₂ D₁ N₂ Ṡ",
    avarohanam: "Ṡ N₂ D₁ P M₁ G₂ R₁ S",
    aliases: ["Natabhairavi"],
  },
  {
    id: "Todi",
    name: "Hanumatodi",
    melakartaNum: 8,
    arohanam: "S R₁ G₂ M₁ P D₁ N₂ Ṡ",
    avarohanam: "Ṡ N₂ D₁ P M₁ G₂ R₁ S",
    aliases: ["Hanumatodi", "Thodi"],
  },
  {
    id: "Varali",
    name: "Varali",
    melakartaNum: 39,
    arohanam: "S R₁ G₂ M₁ P D₁ N₃ Ṡ",
    avarohanam: "Ṡ N₃ D₁ P M₁ G₂ R₁ S",
    aliases: ["Jhalavarali"],
  },
] as const;

const ALIAS_TO_ID = new Map<string, string>();
for (const r of QUIZ_RAGAS) {
  ALIAS_TO_ID.set(normalizeRagaKey(r.id), r.id);
  ALIAS_TO_ID.set(normalizeRagaKey(r.name), r.id);
  for (const a of r.aliases) ALIAS_TO_ID.set(normalizeRagaKey(a), r.id);
}

export function normalizeRagaKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function canonicalQuizRagaId(label: string): string | null {
  return ALIAS_TO_ID.get(normalizeRagaKey(label)) ?? null;
}

export function quizRagaById(id: string): QuizRaga | undefined {
  const canon = canonicalQuizRagaId(id);
  return QUIZ_RAGAS.find((r) => r.id === (canon ?? id));
}

export function randomQuizRaga(excludeId?: string): QuizRaga {
  const pool = excludeId ? QUIZ_RAGAS.filter((r) => r.id !== excludeId) : [...QUIZ_RAGAS];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function ragaLabelsMatch(expectedId: string, predictedLabel: string): boolean {
  const exp = canonicalQuizRagaId(expectedId);
  const pred = canonicalQuizRagaId(predictedLabel);
  return exp != null && pred != null && exp === pred;
}
