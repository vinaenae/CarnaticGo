/**
 * Curated parent melakarta for warmup / scale-quiz pool rāgas missing from dataset.json.
 * Keys are pool `id` values (see scale-quiz-scale-overrides.ts).
 */
export type PracticeRagaParentOverride = {
  parentMelakartaNum: number;
  isMelakarta?: boolean;
};

/** Pool id → parent melakarta (1–72). */
export const PRACTICE_RAGA_PARENT_OVERRIDES: Readonly<
  Record<string, PracticeRagaParentOverride>
> = {
  Atana: { parentMelakartaNum: 29 },
  Bhoopalam: { parentMelakartaNum: 15 },
  Bowli: { parentMelakartaNum: 15 },
  Brindavanasaranga: { parentMelakartaNum: 22 },
  Chandrajyoti: { parentMelakartaNum: 16 },
  Chandrakauns: { parentMelakartaNum: 45 },
  Desh: { parentMelakartaNum: 28 },
  Dwijavanti: { parentMelakartaNum: 28 },
  Gambheeranattai: { parentMelakartaNum: 36 },
  Gowlai: { parentMelakartaNum: 15 },
  Hamsanaadam: { parentMelakartaNum: 29 },
  Jayanthashri: { parentMelakartaNum: 20 },
  Kaanada: { parentMelakartaNum: 22 },
  Kadanakuthoohalam: { parentMelakartaNum: 28 },
  Kalyanavasantham: { parentMelakartaNum: 21 },
  Kannadagowlai: { parentMelakartaNum: 28 },
  Kedaragowlai: { parentMelakartaNum: 28 },
  Lalitha: { parentMelakartaNum: 15 },
  Maand: { parentMelakartaNum: 28 },
  Malayamarutham: { parentMelakartaNum: 16 },
  Nagaswarali: { parentMelakartaNum: 15 },
  Nalinakanthi: { parentMelakartaNum: 29 },
  Nattai: { parentMelakartaNum: 36 },
  Natakurinji: { parentMelakartaNum: 28 },
  NavarasaKanada: { parentMelakartaNum: 22 },
  Neelambari: { parentMelakartaNum: 29 },
  Neelimathi: { parentMelakartaNum: 22 },
  Panthuvarali: { parentMelakartaNum: 51 },
  Poornachandrika: { parentMelakartaNum: 29 },
  Poorvikalyani: { parentMelakartaNum: 53 },
  Rathipathipriya: { parentMelakartaNum: 22 },
  Saraswathi: { parentMelakartaNum: 64 },
  Sri: { parentMelakartaNum: 22 },
  Sivaranjani: { parentMelakartaNum: 20 },
  Sowrashtram: { parentMelakartaNum: 28 },
  Sriranjani: { parentMelakartaNum: 22 },
  Subhapantuvarali: { parentMelakartaNum: 45, isMelakarta: true },
  Sumanesaranjani: { parentMelakartaNum: 28 },
  Sunandavinodini: { parentMelakartaNum: 29 },
  Suruti: { parentMelakartaNum: 28 },
  Surya: { parentMelakartaNum: 29 },
  Thilang: { parentMelakartaNum: 28 },
  Varamu: { parentMelakartaNum: 15 },
  Vasantha: { parentMelakartaNum: 17 },
  Vasanthi: { parentMelakartaNum: 17 },
} as const;
