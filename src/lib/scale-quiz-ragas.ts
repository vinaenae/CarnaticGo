import { QUIZ_RAGAS } from "@/lib/raga-quiz-ragas";
import { SCALE_QUIZ_SCALE_OVERRIDES } from "@/lib/scale-quiz-scale-overrides";

export type ScaleQuizRaga = {
  id: string;
  name: string;
  melakartaNum: number | null;
  arohanam: string;
  avarohanam: string;
};

function buildPool(): ScaleQuizRaga[] {
  const byId = new Map<string, ScaleQuizRaga>();
  for (const r of QUIZ_RAGAS) {
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      melakartaNum: r.melakartaNum,
      arohanam: r.arohanam,
      avarohanam: r.avarohanam,
    });
  }
  for (const [id, o] of Object.entries(SCALE_QUIZ_SCALE_OVERRIDES)) {
    const cur = byId.get(id);
    if (cur) {
      byId.set(id, {
        ...cur,
        name: o.name,
        melakartaNum: o.melakartaNum,
        arohanam: o.arohanam,
        avarohanam: o.avarohanam,
      });
    } else {
      byId.set(id, {
        id,
        name: o.name,
        melakartaNum: o.melakartaNum,
        arohanam: o.arohanam,
        avarohanam: o.avarohanam,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const SCALE_QUIZ_RAGAS: readonly ScaleQuizRaga[] = buildPool();

export type ScaleQuizDifficulty = "beginner" | "intermediate" | "advanced";

/** Rāga ids for the scale-quiz beginner tier (must match pool `id` values). */
const SCALE_QUIZ_BEGINNER_IDS: ReadonlySet<string> = new Set([
  "Sankarabharanam",
  "Abhogi",
  "Bilahari",
  "Malahari",
  "Vasantha",
  "Kalyani",
  "Hamsadhwani",
  "Kambhoji",
  "Mohanam",
]);

/** Rāga ids for the scale-quiz intermediate tier. */
const SCALE_QUIZ_INTERMEDIATE_IDS: ReadonlySet<string> = new Set([
  "Anandabhairavi",
  "Natabhairavi",
  "Bowli",
  "Chakravakam",
  "Charukesi",
  "Darbar",
  "Gowlai",
  "Gambheeranattai",
  "Hamirkalyani",
  "Kaanada",
  "Kannada",
  "Kannadagowlai",
  "Kedaram",
  "Kharaharapriya",
  "Karaharapriya",
  "Khamas",
]);

export function scaleQuizPoolForDifficulty(difficulty: ScaleQuizDifficulty): ScaleQuizRaga[] {
  if (difficulty === "beginner") {
    return SCALE_QUIZ_RAGAS.filter((r) => SCALE_QUIZ_BEGINNER_IDS.has(r.id));
  }
  if (difficulty === "intermediate") {
    return SCALE_QUIZ_RAGAS.filter((r) => SCALE_QUIZ_INTERMEDIATE_IDS.has(r.id));
  }
  const skip = new Set<string>([...SCALE_QUIZ_BEGINNER_IDS, ...SCALE_QUIZ_INTERMEDIATE_IDS]);
  return SCALE_QUIZ_RAGAS.filter((r) => !skip.has(r.id));
}

export function scalePairKey(r: Pick<ScaleQuizRaga, "arohanam" | "avarohanam">): string {
  return `${r.arohanam}\n${r.avarohanam}`;
}

export function randomScaleQuizRaga(
  pool: readonly ScaleQuizRaga[],
  excludeId?: string,
): ScaleQuizRaga {
  const list = excludeId ? pool.filter((r) => r.id !== excludeId) : [...pool];
  const src = list.length > 0 ? list : [...pool];
  return src[Math.floor(Math.random() * src.length)]!;
}
