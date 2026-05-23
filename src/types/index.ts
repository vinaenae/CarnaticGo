import type { BeatLandingVerdict } from "@/lib/audio/beatLanding";

export type SessionScores = {
  pitchAccuracy: number;
  tempoStability: number;
};

export type PitchSample = {
  t: number;
  hz: number | null;
  cents: number | null;
  shruti22Index?: number | null;
  confidence?: number | null;
};

export type VolumeSample = {
  t: number;
  rms: number;
};

export type TempoSample = {
  t: number;
  offsetMs: number;
  ahead: boolean;
  verdict?: BeatLandingVerdict;
  shruti22Index?: number | null;
  svaraShort?: string;
};

export type PracticeConfig = {
  shrutiHz: number;
  tanpuraKey: string;
};

export type DbSession = {
  id: string;
  user_id: string;
  title: string;
  shruti_frequency: number;
  bpm: number;
  tanpura_key: string | null;
  pitch_data: PitchSample[];
  tempo_data: TempoSample[];
  volume_data: VolumeSample[];
  scores: SessionScores | null;
  started_at: string;
  ended_at: string | null;
};

export type DbSessionMetric = {
  id: string;
  session_id: string;
  pitch_accuracy: number | null;
  tempo_stability: number | null;
  volume_consistency: number | null;
  extra: Record<string, unknown> | null;
};
