"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartTimeRange, MergedPitchChartRow } from "@/lib/audio/pitchContour";
import {
  withStackedPitchShapes,
  type StackedPitchChartRow,
} from "@/lib/singalong/pitch-shape-normalize";

const REF_COLOR = "#2563eb";
const USER_COLOR = "#ea580c";
const PLOT_MARGIN = { top: 20, right: 20, left: 8, bottom: 8 };
/** Shared plot: orange upper band, blue lower band with a small gap. */
const DUAL_PLOT_Y_DOMAIN: [number, number] = [-0.04, 1.04];
const Y_AXIS_WIDTH = 48;

export function formatChartTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

function hzAxisDomain(min: number, max: number): [number, number] {
  const span = Math.max(max - min, 100);
  const lo = Math.max(80, min - span * 0.1);
  const topPad = Math.max(span * 0.4, 120);
  let hi = max + topPad;
  hi = Math.max(hi, max * 1.25, min + span * 1.35);
  hi = Math.min(hi, 2000);
  return [lo, hi];
}

function sliceChartRows(
  data: StackedPitchChartRow[],
  opts: {
    playingRef: boolean;
    playingUser: boolean;
    refEndSec: number;
    userEndSecOnAxis: number;
  },
): StackedPitchChartRow[] {
  const { playingRef, playingUser, refEndSec, userEndSecOnAxis } = opts;
  return data.map((row) => {
    const refCut = playingRef && row.refHz != null && row.t > refEndSec + 0.02;
    const userCut =
      playingUser && row.userHz != null && row.t > userEndSecOnAxis + 0.02;
    return {
      ...row,
      refHz: refCut ? null : row.refHz,
      userHz: userCut ? null : row.userHz,
      refShape: refCut ? null : row.refShape,
      userShape: userCut ? null : row.userShape,
      refPlotY: refCut ? null : row.refPlotY,
      userPlotY: userCut ? null : row.userPlotY,
    };
  });
}

function chartHasTrack(
  rows: MergedPitchChartRow[],
  key: "refHz" | "userHz",
): boolean {
  return rows.some((r) => r[key] != null);
}

type ChartSharedProps = {
  maxT: number;
  highlight: ChartTimeRange | null | undefined;
  playingRef: boolean;
  playingUser: boolean;
  refPlayheadSec: number;
  userAxisPlayhead: number;
};

function HighlightAndPlayheads({
  highlight,
  playingRef,
  playingUser,
  refPlayheadSec,
  userAxisPlayhead,
}: ChartSharedProps) {
  return (
    <>
      {highlight && highlight.endSec > highlight.startSec && (
        <ReferenceArea
          x1={highlight.startSec}
          x2={highlight.endSec}
          fill="#8b5cf6"
          fillOpacity={0.18}
          stroke="#7c3aed"
          strokeOpacity={0.45}
          strokeWidth={1}
        />
      )}
      {playingRef && (
        <ReferenceLine
          x={refPlayheadSec}
          stroke="#111827"
          strokeWidth={1.5}
          strokeOpacity={0.35}
        />
      )}
      {playingUser && !playingRef && (
        <ReferenceLine
          x={userAxisPlayhead}
          stroke="#111827"
          strokeWidth={1.5}
          strokeOpacity={0.35}
        />
      )}
    </>
  );
}

/** Orange on top, blue directly below — one shared plot (shadow-style offset). */
function DualOffsetPitchChart({
  rows,
  maxT,
  hasRef,
  hasUser,
  refLineDimmed,
  userLineDimmed,
  shared,
}: {
  rows: StackedPitchChartRow[];
  maxT: number;
  hasRef: boolean;
  hasUser: boolean;
  refLineDimmed: boolean;
  userLineDimmed: boolean;
  shared: ChartSharedProps;
}) {
  return (
    <>
      <TrackLabels hasRef={hasRef} hasUser={hasUser} />
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={PLOT_MARGIN}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis
            type="number"
            dataKey="t"
            domain={[0, maxT]}
            axisLine={{ stroke: "#9ca3af" }}
            tickLine={{ stroke: "#9ca3af" }}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v) => formatChartTime(Number(v))}
            label={{
              value: "Time",
              position: "insideBottom",
              offset: -4,
              style: { fontSize: 12, fill: "#6b7280", fontWeight: 500 },
            }}
          />
          <YAxis type="number" domain={DUAL_PLOT_Y_DOMAIN} hide width={0} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 12,
            }}
            labelFormatter={(t) => `Time: ${formatChartTime(Number(t))}`}
            formatter={(val, name) => {
              const n = typeof val === "number" ? val : Number(val);
              if (!Number.isFinite(n)) {
                return ["—", name === "userPlotY" ? "Your singing" : "Reference"];
              }
              return [
                `${Math.round(n * 100)}% contour`,
                name === "userPlotY" ? "Your singing" : "Reference",
              ];
            }}
          />
          <HighlightAndPlayheads {...shared} />
          {hasRef ? (
            <Line
              type="linear"
              dataKey="refPlotY"
              name="refPlotY"
              stroke={REF_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
              strokeOpacity={refLineDimmed ? 0.28 : 1}
              clipPath="none"
            />
          ) : null}
          {hasUser ? (
            <Line
              type="linear"
              dataKey="userPlotY"
              name="userPlotY"
              stroke={USER_COLOR}
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
              strokeOpacity={userLineDimmed ? 0.28 : 1}
              clipPath="none"
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

export function SingAlongPitchChart({
  data,
  playingRef,
  playingUser,
  refPlayheadSec,
  userPlayheadSec,
  userPlayheadOnRefAxis,
  maxDurationSec,
  selectedRange,
  onSelectedRangeChange,
  title = "Pitch frequency over time",
}: {
  data: MergedPitchChartRow[];
  playingRef: boolean;
  playingUser: boolean;
  refPlayheadSec: number;
  userPlayheadSec: number;
  userPlayheadOnRefAxis: number;
  maxDurationSec: number;
  selectedRange: ChartTimeRange | null;
  onSelectedRangeChange: (range: ChartTimeRange | null) => void;
  title?: string;
}) {
  const userAxisPlayhead = userPlayheadOnRefAxis;
  const plotRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ anchorSec: number; endSec: number } | null>(null);

  const hasRef = chartHasTrack(data, "refHz");
  const hasUser = chartHasTrack(data, "userHz");
  const bothTracks = hasRef && hasUser;

  const shapedData = useMemo(() => withStackedPitchShapes(data), [data]);

  const chartRows = useMemo(() => {
    if (shapedData.length === 0) return [];
    if (!playingRef && !playingUser) return shapedData;
    return sliceChartRows(shapedData, {
      playingRef,
      playingUser,
      refEndSec: refPlayheadSec,
      userEndSecOnAxis: userAxisPlayhead,
    });
  }, [shapedData, playingRef, playingUser, refPlayheadSec, userAxisPlayhead]);

  const yValues = data.flatMap((r) => [r.refHz, r.userHz].filter((h): h is number => h != null));
  const [yMin, yMax] = yValues.length
    ? hzAxisDomain(Math.min(...yValues), Math.max(...yValues))
    : [150, 1000];

  const isPlaying = playingRef || playingUser;
  const refLineDimmed = playingUser && !playingRef;
  const userLineDimmed = playingRef && !playingUser;
  const maxT = Math.max(maxDurationSec, 0.1);

  const highlight =
    dragging != null
      ? {
          startSec: Math.min(dragging.anchorSec, dragging.endSec),
          endSec: Math.max(dragging.anchorSec, dragging.endSec),
        }
      : selectedRange;

  const sharedChart: ChartSharedProps = {
    maxT,
    highlight,
    playingRef,
    playingUser,
    refPlayheadSec,
    userAxisPlayhead,
  };

  const clientXToTime = useCallback(
    (clientX: number): number | null => {
      const el = plotRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const plotLeft =
        rect.left + PLOT_MARGIN.left + (bothTracks ? 8 : Y_AXIS_WIDTH);
      const plotRight = rect.right - PLOT_MARGIN.right;
      const plotWidth = plotRight - plotLeft;
      if (plotWidth <= 0) return null;
      const x = clientX - plotLeft;
      return Math.max(0, Math.min(maxT, (x / plotWidth) * maxT));
    },
    [maxT, bothTracks],
  );

  const finishDrag = useCallback(
    (endSec: number, anchorSec: number) => {
      const startSec = Math.min(anchorSec, endSec);
      const end = Math.max(anchorSec, endSec);
      if (end - startSec >= 0.12) {
        onSelectedRangeChange({ startSec, endSec: end });
      }
    },
    [onSelectedRangeChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = clientXToTime(e.clientX);
    if (t == null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ anchorSec: t, endSec: t });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const t = clientXToTime(e.clientX);
    if (t == null) return;
    setDragging({ anchorSec: dragging.anchorSec, endSec: t });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    const t = clientXToTime(e.clientX) ?? dragging.endSec;
    finishDrag(t, dragging.anchorSec);
    setDragging(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (data.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-md dark:bg-card">
        <h3 className="border-b border-border/60 px-4 py-3 text-center text-base font-medium tracking-tight text-foreground">
          {title}
        </h3>
        <div className="flex h-80 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Upload reference and your recording to see the frequency lines draw here.
        </div>
      </div>
    );
  }

  const dragOverlayLeft = bothTracks
    ? PLOT_MARGIN.left + 8
    : PLOT_MARGIN.left + Y_AXIS_WIDTH + 8;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-md dark:bg-card">
      <h3 className="border-b border-border/60 px-4 py-3 text-center text-base font-medium tracking-tight text-foreground">
        {title}
      </h3>

      <div ref={plotRef} className="relative h-[22rem] w-full px-2 pb-1 pt-3 md:h-96">
        <div className="absolute inset-x-2 bottom-1 top-3">
          {bothTracks ? (
            <DualOffsetPitchChart
              rows={chartRows}
              maxT={maxT}
              hasRef={hasRef}
              hasUser={hasUser}
              refLineDimmed={refLineDimmed}
              userLineDimmed={userLineDimmed}
              shared={sharedChart}
            />
          ) : (
            <>
              <TrackLabels hasRef={hasRef} hasUser={hasUser} />
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={PLOT_MARGIN}>
                  <CartesianGrid strokeDasharray="0" stroke="#e5e7eb" vertical={false} />
              <XAxis
                type="number"
                dataKey="t"
                domain={[0, maxT]}
                axisLine={{ stroke: "#9ca3af" }}
                tickLine={{ stroke: "#9ca3af" }}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickFormatter={(v) => formatChartTime(Number(v))}
                label={{
                  value: "Time",
                  position: "insideBottom",
                  offset: -4,
                  style: { fontSize: 12, fill: "#6b7280", fontWeight: 500 },
                }}
              />
              <YAxis
                width={Y_AXIS_WIDTH}
                domain={[yMin, yMax]}
                axisLine={{ stroke: "#9ca3af" }}
                tickLine={{ stroke: "#9ca3af" }}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickFormatter={(v) => `${Math.round(Number(v))}`}
                label={{
                  value: "Frequency (Hz)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 12,
                  style: { fontSize: 12, fill: "#6b7280", fontWeight: 500 },
                }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
                labelFormatter={(t) => `Time: ${formatChartTime(Number(t))}`}
                formatter={(val, name) => {
                  const n = typeof val === "number" ? val : Number(val);
                  if (!Number.isFinite(n)) {
                    return ["—", name === "refHz" ? "Reference" : "Your singing"];
                  }
                  return [
                    `${Math.round(n)} Hz`,
                    name === "refHz" ? "Reference" : "Your singing",
                  ];
                }}
              />
              <HighlightAndPlayheads {...sharedChart} />
              {hasRef ? (
                <Line
                  type="linear"
                  dataKey="refHz"
                  name="refHz"
                  stroke={REF_COLOR}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  strokeOpacity={refLineDimmed ? 0.28 : 1}
                  clipPath="none"
                />
              ) : null}
              {hasUser ? (
                <Line
                  type="linear"
                  dataKey="userHz"
                  name="userHz"
                  stroke={USER_COLOR}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  strokeOpacity={userLineDimmed ? 0.28 : 1}
                  clipPath="none"
                />
              ) : null}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        <div
          className="absolute inset-x-2 bottom-1 top-3 cursor-crosshair touch-none"
          style={{ left: dragOverlayLeft, right: PLOT_MARGIN.right + 8 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="Drag to highlight a time range on the chart"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 border-t border-border/60 px-4 py-3">
        <LegendItem color={REF_COLOR} label="Reference clip" active={!refLineDimmed} />
        <LegendItem color={USER_COLOR} label="Your singing" active={!userLineDimmed} />
        <span className="text-xs text-muted-foreground">Drag across the chart to highlight</span>
        {isPlaying && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {playingRef && playingUser
              ? `Drawing · ref ${formatChartTime(refPlayheadSec)} · you ${formatChartTime(userPlayheadSec)}`
              : playingRef
                ? `Drawing · ${formatChartTime(refPlayheadSec)}`
                : `Drawing · ${formatChartTime(userPlayheadSec)}`}
          </span>
        )}
      </div>
    </div>
  );
}

function TrackLabels({
  hasRef,
  hasUser,
}: {
  hasRef: boolean;
  hasUser: boolean;
}) {
  return (
    <div className="pointer-events-none absolute left-14 right-3 top-1 z-10 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wide">
      {hasRef ? <span className="text-[#2563eb]">Reference</span> : null}
      {hasUser ? <span className="text-[#ea580c]">Your singing</span> : null}
    </div>
  );
}

function LegendItem({
  color,
  label,
  active,
}: {
  color: string;
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm" style={{ opacity: active ? 1 : 0.45 }}>
      <span className="inline-block h-0.5 w-8 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-foreground/90">{label}</span>
    </div>
  );
}
