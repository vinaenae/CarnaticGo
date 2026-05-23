/** Response from `POST /api/rhythm/analyze` (librosa pipeline, Carnatic beat reference only). */
export type RhythmAnalyzeResponse = {
  averageTimingOffsetMs: number;
  rhythmStabilityScore: number;
  beatAlignmentScore: number;
  detectedOnsets: number[];
  confidence: number;
  beatPeriodSec: number;
  cycleBeats: number;
  gridPhaseSec: number;
};

export type RhythmAnalyzeParams = {
  /** Metronome BPM (must match practice session). */
  bpm: number;
  /** Fixed tala; MVP supports `"adi"` only. */
  tala?: "adi";
};
