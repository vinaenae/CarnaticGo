import {
  bridgePitchChartPoints,
  contourToChartPoints,
  smoothPitchContourForChart,
  type PitchChartPoint,
  type RawPitchContour,
} from "@/lib/audio/pitchContour";

/** Build a raw contour from browser ml5 live samples. */
export function chartPointsToRawContour(points: readonly PitchChartPoint[]): RawPitchContour {
  const valid = points.filter((p) => p.hz != null && Number.isFinite(p.hz) && p.hz > 55);
  const n = valid.length;
  const timesSec = new Float32Array(n);
  const hz = new Float32Array(n);
  const voiced = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const p = valid[i]!;
    timesSec[i] = p.t;
    hz[i] = p.hz!;
    voiced[i] = 1;
  }
  return { timesSec, hz, voiced };
}

/** Smooth live ml5 points for the same chart pipeline as offline CREPE. */
export function chartPointsFromMl5Live(points: readonly PitchChartPoint[]): PitchChartPoint[] {
  if (points.length === 0) return [];
  const bridged = bridgePitchChartPoints(points);
  const raw = chartPointsToRawContour(bridged);
  return contourToChartPoints(smoothPitchContourForChart(raw));
}

/** Bridge short gaps before merging into the live chart. */
export function livePitchPointsForChart(points: readonly PitchChartPoint[]): PitchChartPoint[] {
  return bridgePitchChartPoints(points);
}
