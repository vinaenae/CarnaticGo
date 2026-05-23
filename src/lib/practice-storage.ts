import type { ClickStyle } from "@/lib/audio/metronome";
import { DEFAULT_TANPURA_KEY, nominalHzForTanpuraKey } from "@/lib/audio/tanpura-manifest";
import { isPracticeModeId, type PracticeModeId } from "@/lib/practice-modes";

export const practiceConfigStorageKey = (sessionId: string) =>
  `ragify-practice-config:${sessionId}`;

/** Default tāla-guide tempo (not an audible metronome). */
export const DEFAULT_PRACTICE_BPM = 72;

export type PracticeConfigStored = {
  tanpuraKey: string;
  shrutiHz: number;
  bpm: number;
  clickStyle: ClickStyle;
  title?: string;
  ragaId?: string;
  practiceMode?: PracticeModeId;
};

export function defaultPracticeConfig(
  overrides?: Partial<PracticeConfigStored>,
): PracticeConfigStored {
  const tanpuraKey = overrides?.tanpuraKey ?? DEFAULT_TANPURA_KEY;
  return {
    tanpuraKey,
    shrutiHz: nominalHzForTanpuraKey(tanpuraKey),
    bpm: overrides?.bpm ?? DEFAULT_PRACTICE_BPM,
    clickStyle: overrides?.clickStyle ?? "click",
    title: overrides?.title,
    ragaId: overrides?.ragaId,
  };
}

export function writePracticeConfig(sessionId: string, payload: PracticeConfigStored) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    practiceConfigStorageKey(sessionId),
    JSON.stringify(payload),
  );
}

export type ResolvedPracticeConfig = PracticeConfigStored;

export function readPracticeConfig(sessionId: string): ResolvedPracticeConfig | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(practiceConfigStorageKey(sessionId));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PracticeConfigStored>;
    const tanpuraKey =
      typeof v.tanpuraKey === "string" && v.tanpuraKey.length > 0
        ? v.tanpuraKey
        : DEFAULT_TANPURA_KEY;
    const clickStyle: ClickStyle =
      v.clickStyle === "wood" || v.clickStyle === "soft" || v.clickStyle === "click"
        ? v.clickStyle
        : "click";
    return {
      tanpuraKey,
      shrutiHz: nominalHzForTanpuraKey(tanpuraKey),
      bpm:
        typeof v.bpm === "number" && v.bpm > 0 ? v.bpm : DEFAULT_PRACTICE_BPM,
      clickStyle,
      title: typeof v.title === "string" ? v.title : undefined,
      ragaId: typeof v.ragaId === "string" && v.ragaId.length > 0 ? v.ragaId : undefined,
      practiceMode:
        typeof v.practiceMode === "string" && isPracticeModeId(v.practiceMode)
          ? v.practiceMode
          : "warmup",
    };
  } catch {
    /* ignore */
  }
  return null;
}
