/**
 * Looped accompaniment for quiz recordings — approximates sam-carnatic dataset ambience.
 * Files: /assets/accompaniment/*.wav (generate via `npm run generate:accompaniment`).
 */

export type AccompanimentLoop = {
  id: "mridangam_adi" | "tabla_tintal";
  label: string;
  file: string;
};

export const ACCOMPANIMENT_LOOPS: readonly AccompanimentLoop[] = [
  {
    id: "mridangam_adi",
    label: "Mridangam (slow adi tala)",
    file: "mridangam-adi-slow.wav",
  },
  {
    id: "tabla_tintal",
    label: "Tabla (teen taal)",
    file: "tabla-tintal-slow.wav",
  },
] as const;

export const ACCOMPANIMENT_ASSET_PREFIX = "/assets/accompaniment/";
