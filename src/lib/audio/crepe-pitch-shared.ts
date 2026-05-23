import type { RawPitchContour } from "@/lib/audio/pitchContour";

export type CrepePitchResponse = {
  sampleRate: number;
  timesSec: number[];
  hz: (number | null)[];
  voicedFrames: number;
  engine: string;
};

export class CrepePitchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "CrepePitchError";
  }
}

export function contourFromCrepeResponse(res: CrepePitchResponse): RawPitchContour {
  const n = res.timesSec.length;
  const timesSec = new Float32Array(n);
  const hz = new Float32Array(n);
  const voiced = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    timesSec[i] = res.timesSec[i]!;
    const h = res.hz[i];
    if (h != null && Number.isFinite(h)) {
      hz[i] = h;
      voiced[i] = 1;
    } else {
      hz[i] = NaN;
      voiced[i] = 0;
    }
  }
  return { timesSec, hz, voiced };
}
