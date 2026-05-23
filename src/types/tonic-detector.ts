export type TonicDetectResponse = {
  tonic: string;
  kattai: string;
  kattaiKey: string;
  confidence: number;
  probabilities: Record<string, number>;
  source: string;
};
