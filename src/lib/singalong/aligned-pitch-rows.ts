import {
  computeDtwChartAlignment,
  contourToChartPoints,
  warpUserChartPointsToReference,
  type RawPitchContour,
} from "@/lib/audio/pitchContour";

export type AlignedPitchRow = {
  /** Reference timeline (seconds) after DTW. */
  tRefSec: number;
  refHz: number | null;
  /** Your pitch at the DTW-matched moment, plotted on reference time. */
  userHzAligned: number | null;
  cents: number | null;
};

function centsBetween(hzRef: number, hzUser: number): number {
  return 1200 * Math.log2(hzUser / hzRef);
}

/** Reference + user pitch rows on the same reference timeline (DTW-warped user). */
export function buildAlignedPitchRows(
  refContour: RawPitchContour,
  userContour: RawPitchContour,
): AlignedPitchRow[] | null {
  const ref = contourToChartPoints(refContour);
  const user = contourToChartPoints(userContour);
  const alignment = computeDtwChartAlignment(ref, user);
  if (!alignment) return null;

  const warped = warpUserChartPointsToReference(ref, user, alignment);
  return ref.map((p, i) => {
    const refHz = p.hz;
    const userHzAligned = warped[i]?.hz ?? null;
    const cents =
      refHz != null &&
      userHzAligned != null &&
      Number.isFinite(refHz) &&
      Number.isFinite(userHzAligned)
        ? centsBetween(refHz, userHzAligned)
        : null;
    return {
      tRefSec: p.t,
      refHz,
      userHzAligned,
      cents,
    };
  });
}

const DEFAULT_MAX_DISPLAY_ROWS = 500;

export function downsampleAlignedRows(
  rows: AlignedPitchRow[],
  maxRows = DEFAULT_MAX_DISPLAY_ROWS,
): { rows: AlignedPitchRow[]; total: number; stride: number } {
  if (rows.length <= maxRows) {
    return { rows, total: rows.length, stride: 1 };
  }
  const stride = Math.ceil(rows.length / maxRows);
  return {
    rows: rows.filter((_, i) => i % stride === 0),
    total: rows.length,
    stride,
  };
}

export function formatPitchHz(hz: number | null): string {
  if (hz == null || !Number.isFinite(hz)) return "—";
  return hz.toFixed(1);
}

export function formatPitchTime(sec: number): string {
  return sec.toFixed(2);
}

export function formatPitchCents(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const sign = cents > 0 ? "+" : "";
  return `${sign}${Math.round(cents)}`;
}
