/**
 * Tanpura loop registry: Sa = row 1 of the printed 22-shruti chart for that key (`shruti22-chart.ts`).
 * Labels keep Western + kattai numbers; D#/G#/A# keys use the chart’s E♭ / A♭ / B♭ column Hz.
 */

import { nominalChartSaHz } from "@/lib/audio/shruti22-chart";

export type TanpuraManifestEntry = {
  key: string;
  /** Setup UI: Western note + reference + Sa Hz (chart row 1). */
  label: string;
  file: string;
  nominalSaHz: number;
};

/** Bundled tanpura drones: pa–SA–SA–sa family, one file per chart column. */
export const TANPURA_SAMPLE_MANIFEST: TanpuraManifestEntry[] = [
  { key: "kattai_1", label: "C — 1 · Sa 261.63 Hz", file: "pa-sa-sa-sa-kattai-1.wav", nominalSaHz: nominalChartSaHz("kattai_1") },
  { key: "kattai_1_5", label: "C# — 1½ · Sa 277.18 Hz", file: "pa-sa-sa-sa-kattai-1-5.wav", nominalSaHz: nominalChartSaHz("kattai_1_5") },
  { key: "kattai_2", label: "D — 2 · Sa 293.66 Hz", file: "pa-sa-sa-sa-kattai-2.wav", nominalSaHz: nominalChartSaHz("kattai_2") },
  { key: "kattai_2_5", label: "D# — 2½ · Sa 311.13 Hz", file: "pa-sa-sa-sa-kattai-2-5.wav", nominalSaHz: nominalChartSaHz("kattai_2_5") },
  { key: "kattai_3", label: "E — 3 · Sa 329.63 Hz", file: "pa-sa-sa-sa-kattai-3.wav", nominalSaHz: nominalChartSaHz("kattai_3") },
  { key: "kattai_4", label: "F — 4 · Sa 349.23 Hz", file: "pa-sa-sa-sa-kattai-4.wav", nominalSaHz: nominalChartSaHz("kattai_4") },
  { key: "kattai_4_5", label: "F# — 4½ · Sa 369.99 Hz", file: "pa-sa-sa-sa-kattai-4-5.wav", nominalSaHz: nominalChartSaHz("kattai_4_5") },
  { key: "kattai_5", label: "G — 5 · Sa 392.00 Hz", file: "pa-sa-sa-sa-kattai-5.wav", nominalSaHz: nominalChartSaHz("kattai_5") },
  { key: "kattai_5_5", label: "G# — 5½ · Sa 415.30 Hz", file: "pa-sa-sa-sa-kattai-5-5.wav", nominalSaHz: nominalChartSaHz("kattai_5_5") },
  { key: "kattai_6", label: "A — 6 · Sa 440.00 Hz", file: "pa-sa-sa-sa-kattai-6.wav", nominalSaHz: nominalChartSaHz("kattai_6") },
  { key: "kattai_6_5", label: "A# — 6½ · Sa 466.16 Hz", file: "pa-sa-sa-sa-kattai-6-5.wav", nominalSaHz: nominalChartSaHz("kattai_6_5") },
  { key: "kattai_7", label: "B — 7 · Sa 493.88 Hz", file: "pa-sa-sa-sa-kattai-7.wav", nominalSaHz: nominalChartSaHz("kattai_7") },
  { key: "kattai_7_5", label: "B# — 7½ · Sa 523.25 Hz", file: "pa-sa-sa-sa-kattai-7-5.wav", nominalSaHz: nominalChartSaHz("kattai_7_5") },
];

export const DEFAULT_TANPURA_KEY = TANPURA_SAMPLE_MANIFEST[0]!.key;

export function nominalHzForTanpuraKey(key: string): number {
  return nominalChartSaHz(key);
}

/** Mandra (lower octave) Sa for warmup for your song — half of chart row-1 Sa. */
export function nominalHzForWarmupTanpuraKey(key: string): number {
  return nominalChartSaHz(key) / 2;
}

/** Shruti dropdown labels for warmup (Western note only). */
export function warmupShrutiSelectLabel(key: string): string {
  const label = TANPURA_SAMPLE_MANIFEST.find((e) => e.key === key)?.label ?? key;
  const note = label.split(" — ")[0]?.trim();
  return note && note.length > 0 ? note : key;
}

export const labelForTanpuraKey = (key: string): string =>
  TANPURA_SAMPLE_MANIFEST.find((e) => e.key === key)?.label ?? key;
