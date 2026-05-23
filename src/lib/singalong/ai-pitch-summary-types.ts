export type AiPitchMistake = {
  timestamp: string;
  issue: string;
  fix: string;
};

export type AiPitchSummaryResult = {
  summary: string;
  mistakes: AiPitchMistake[];
};

export type GeminiChartSample = {
  tSec: number;
  /** Normalized 0–1 pitch shape (reference panel, top). */
  refShape: number | null;
  /** Normalized 0–1 pitch shape (user panel, bottom; DTW-aligned time). */
  userShape: number | null;
  /** Raw Hz kept for optional context. */
  refHz?: number | null;
  userHz?: number | null;
};

export type SingAlongAiSummaryRequest = {
  chart: GeminiChartSample[];
  durationSec: number;
  /** Optional hints from rule-based pitch analysis (flatness windows, etc.). */
  algorithmicHints?: string;
};
