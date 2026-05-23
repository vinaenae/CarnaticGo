import type { MergedPitchChartRow } from "@/lib/audio/pitchContour";

/** Vertical inset so stacked shape lines do not sit on the plot edge (avoids clipping). */
const SHAPE_INSET = 0.08;

/** Normalize voiced Hz per track to 0–1 for stacked shape comparison (gamaka contour). */
export function normalizeHzSeries(values: (number | null)[]): (number | null)[] {
  const voiced = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (voiced.length === 0) return values.map(() => null);
  const min = Math.min(...voiced);
  const max = Math.max(...voiced);
  const span = max - min || 1;
  const lo = SHAPE_INSET;
  const hi = 1 - SHAPE_INSET;
  return values.map((v) =>
    v == null || !Number.isFinite(v)
      ? null
      : Math.round((lo + ((v - min) / span) * (hi - lo)) * 1000) / 1000,
  );
}

export type StackedPitchChartRow = {
  t: number;
  refHz: number | null;
  userHz: number | null;
  refShape: number | null;
  userShape: number | null;
  /** Blue line Y in shared plot (reference, lower band). */
  refPlotY: number | null;
  /** Orange line Y in shared plot (your singing, upper band). */
  userPlotY: number | null;
};

/** Orange on top, blue directly underneath — same chart, small vertical gap. */
/** Small gap between orange (top) and blue (bottom) in the shared plot. */
const USER_BAND = { lo: 0.50, hi: 0.94 };
const REF_BAND = { lo: 0.06, hi: 0.46 };

function shapeToBand(
  shape: number | null,
  band: { lo: number; hi: number },
): number | null {
  if (shape == null || !Number.isFinite(shape)) return null;
  const span = 1 - 2 * SHAPE_INSET;
  const norm = (shape - SHAPE_INSET) / span;
  return Math.round((band.lo + norm * (band.hi - band.lo)) * 1000) / 1000;
}

export function withStackedPitchShapes(rows: MergedPitchChartRow[]): StackedPitchChartRow[] {
  const refShapes = normalizeHzSeries(rows.map((r) => r.refHz));
  const userShapes = normalizeHzSeries(rows.map((r) => r.userHz));
  return rows.map((r, i) => {
    const refShape = refShapes[i] ?? null;
    const userShape = userShapes[i] ?? null;
    return {
      ...r,
      refShape,
      userShape,
      refPlotY: shapeToBand(refShape, REF_BAND),
      userPlotY: shapeToBand(userShape, USER_BAND),
    };
  });
}
