/**
 * Suladi sapta tāla × pañca jāti beat cycles (Carnatic hand-kept tāla).
 * @see https://paramukurumathur.com/11-indian-music-systems-tala/
 *
 * Angas: I (laghu) = clap + (jāti−1) finger counts; O (drutam) = clap + wave; U (anudrutam) = clap.
 */

export type TalaId =
  | "eka"
  | "rupaka"
  | "jhampa"
  | "triputa"
  | "matya"
  | "ata"
  | "dhruva";

export type JatiId = "tisra" | "chatusra" | "khanda" | "mishra" | "sankeerna";

export type AngaSymbol = "I" | "O" | "U";

export type TalaGesture = "clap" | "wave" | "count";

/** Laghu finger counts after the clap: pinky → ring → middle → index → thumb, then repeat if needed. */
export type TalaCountFinger = "pinky" | "ring" | "middle" | "index" | "thumb";

const LAGHU_COUNT_FINGER_ORDER: readonly TalaCountFinger[] = [
  "pinky",
  "ring",
  "middle",
  "index",
  "thumb",
  "pinky",
  "ring",
  "middle",
] as const;

const COUNT_FINGER_LABEL: Record<TalaCountFinger, string> = {
  pinky: "pinky",
  ring: "ring",
  middle: "middle",
  index: "index",
  thumb: "thumb",
};

export type TalaBeatStep = {
  gesture: TalaGesture;
  /** Which finger to count on (laghu only, after the clap). */
  countFinger?: TalaCountFinger;
  anga: AngaSymbol;
  beatInCycle: number;
};

export type TalaDefinition = {
  id: TalaId;
  name: string;
  notation: string;
  angas: readonly AngaSymbol[];
};

export type JatiDefinition = {
  id: JatiId;
  name: string;
  laghuBeats: number;
};

export const CARNATIC_JATIS: readonly JatiDefinition[] = [
  { id: "tisra", name: "Tisra", laghuBeats: 3 },
  { id: "chatusra", name: "Chatusra", laghuBeats: 4 },
  { id: "khanda", name: "Khanda", laghuBeats: 5 },
  { id: "mishra", name: "Mishra", laghuBeats: 7 },
  { id: "sankeerna", name: "Sankeerna", laghuBeats: 9 },
] as const;

export const CARNATIC_TALAS: readonly TalaDefinition[] = [
  { id: "eka", name: "Eka", notation: "I", angas: ["I"] },
  { id: "rupaka", name: "Rupaka", notation: "O I", angas: ["O", "I"] },
  { id: "jhampa", name: "Jhampa", notation: "I U O", angas: ["I", "U", "O"] },
  { id: "triputa", name: "Triputa", notation: "I O O", angas: ["I", "O", "O"] },
  { id: "matya", name: "Matya", notation: "I O I", angas: ["I", "O", "I"] },
  { id: "ata", name: "Ata", notation: "I I O O", angas: ["I", "I", "O", "O"] },
  { id: "dhruva", name: "Dhruva", notation: "I O I I", angas: ["I", "O", "I", "I"] },
] as const;

/** Chart totals — (I×jāti) + (O×2) + (U×1) per cycle. */
export const TALA_JATI_BEAT_MATRIX: Record<TalaId, Record<JatiId, number>> = {
  eka: { tisra: 3, chatusra: 4, khanda: 5, mishra: 7, sankeerna: 9 },
  rupaka: { tisra: 5, chatusra: 6, khanda: 7, mishra: 9, sankeerna: 11 },
  jhampa: { tisra: 6, chatusra: 7, khanda: 8, mishra: 10, sankeerna: 12 },
  triputa: { tisra: 7, chatusra: 8, khanda: 9, mishra: 11, sankeerna: 13 },
  matya: { tisra: 8, chatusra: 10, khanda: 12, mishra: 16, sankeerna: 20 },
  ata: { tisra: 10, chatusra: 12, khanda: 14, mishra: 18, sankeerna: 22 },
  dhruva: { tisra: 11, chatusra: 14, khanda: 17, mishra: 23, sankeerna: 29 },
};

export function jatiById(id: JatiId): JatiDefinition {
  return CARNATIC_JATIS.find((j) => j.id === id) ?? CARNATIC_JATIS[1]!;
}

export function talaById(id: TalaId): TalaDefinition {
  return CARNATIC_TALAS.find((t) => t.id === id) ?? CARNATIC_TALAS[3]!;
}

export function totalBeatsForTalaJati(talaId: TalaId, jatiId: JatiId): number {
  return TALA_JATI_BEAT_MATRIX[talaId][jatiId];
}

function expandAnga(anga: AngaSymbol, laghuBeats: number): Omit<TalaBeatStep, "beatInCycle">[] {
  if (anga === "U") return [{ gesture: "clap", anga: "U" }];
  if (anga === "O") return [
    { gesture: "clap", anga: "O" },
    { gesture: "wave", anga: "O" },
  ];
  const steps: Omit<TalaBeatStep, "beatInCycle">[] = [{ gesture: "clap", anga: "I" }];
  for (let i = 0; i < laghuBeats - 1; i++) {
    steps.push({
      gesture: "count",
      countFinger: LAGHU_COUNT_FINGER_ORDER[i] ?? "pinky",
      anga: "I",
    });
  }
  return steps;
}

export function buildTalaBeatCycle(talaId: TalaId, jatiId: JatiId): TalaBeatStep[] {
  const tala = talaById(talaId);
  const laghuBeats = jatiById(jatiId).laghuBeats;
  const flat: Omit<TalaBeatStep, "beatInCycle">[] = [];
  for (const anga of tala.angas) flat.push(...expandAnga(anga, laghuBeats));
  return flat.map((step, i) => ({ ...step, beatInCycle: i + 1 }));
}

export function talaJatiLabel(talaId: TalaId, jatiId: JatiId): string {
  const tala = talaById(talaId);
  const jati = jatiById(jatiId);
  const beats = totalBeatsForTalaJati(talaId, jatiId);
  const adi =
    talaId === "triputa" && jatiId === "chatusra" ? " (Ādi tāla)" : "";
  return `${jati.name} ${tala.name}${adi} · ${beats} beats`;
}

export function gestureLabel(step: TalaBeatStep): string {
  if (step.gesture === "clap") {
    if (step.anga === "U") return "Anudrutam — clap";
    if (step.anga === "O") return "Drutam — clap (palm down)";
    return "Laghu — clap (palm down)";
  }
  if (step.gesture === "wave") return "Drutam — wave (palm up)";
  const name = step.countFinger ? COUNT_FINGER_LABEL[step.countFinger] : "pinky";
  return `Laghu — count on ${name} finger`;
}

export function countFingerMeshIndex(finger: TalaCountFinger): number {
  const map: Record<TalaCountFinger, number> = {
    thumb: 0,
    index: 1,
    middle: 2,
    ring: 3,
    pinky: 4,
  };
  return map[finger];
}

export function countFingerShort(finger: TalaCountFinger): string {
  const map: Record<TalaCountFinger, string> = {
    pinky: "P",
    ring: "R",
    middle: "M",
    index: "I",
    thumb: "T",
  };
  return map[finger];
}
