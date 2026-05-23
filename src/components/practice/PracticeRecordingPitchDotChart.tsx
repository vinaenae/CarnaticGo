"use client";

import { useMemo, useState } from "react";
import type { PracticePitchDot } from "@/lib/audio/practiceShrutiAnalysis";
import { formatPracticeShrutiTime } from "@/lib/audio/practiceShrutiAnalysis";
import { CREPE_DISPLAY_HIT_CENTS } from "@/lib/audio/shrutiRowBand";

const TARGET_LINE = "#22c55e";
const SING_ON = "#16a34a";
const SING_OFF = "#ef4444";
const BAND_FILL = "rgba(34, 197, 94, 0.12)";

const VB = { w: 880, h: 400, ml: 56, mr: 72, mt: 14, mb: 40 };

export function PracticeRecordingPitchDotChart({
  dots,
  chartAnchorsHz,
  maxDurationSec,
  chartColumnTitle,
}: {
  dots: PracticePitchDot[];
  chartAnchorsHz: number[];
  maxDurationSec: number;
  chartColumnTitle: string;
}) {
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);

  const plotW = VB.w - VB.ml - VB.mr;
  const plotH = VB.h - VB.mt - VB.mb;
  const maxT = Math.max(maxDurationSec, 0.1);

  const centsDomain = useMemo((): [number, number] => {
    const vals = dots.map((d) => d.cents);
    if (vals.length === 0) return [-40, 40];
    const min = Math.min(...vals, -CREPE_DISPLAY_HIT_CENTS);
    const max = Math.max(...vals, CREPE_DISPLAY_HIT_CENTS);
    const pad = Math.max(12, (max - min) * 0.15);
    return [Math.min(-80, min - pad), Math.max(80, max + pad)];
  }, [dots]);

  const [cMin, cMax] = centsDomain;

  const xScale = (t: number) => VB.ml + (t / maxT) * plotW;
  const yCents = (c: number) => VB.mt + plotH - ((c - cMin) / (cMax - cMin)) * plotH;

  const yTicksC = useMemo(() => {
    const out: number[] = [];
    const step = cMax - cMin > 120 ? 40 : 20;
    for (let c = Math.ceil(cMin / step) * step; c <= cMax; c += step) out.push(c);
    return out;
  }, [cMin, cMax]);

  const xTicks = useMemo(() => {
    const n = Math.min(6, Math.max(3, Math.ceil(maxT / 4)));
    return Array.from({ length: n + 1 }, (_, i) => (maxT * i) / n);
  }, [maxT]);

  const bandTop = yCents(CREPE_DISPLAY_HIT_CENTS);
  const bandBottom = yCents(-CREPE_DISPLAY_HIT_CENTS);
  const zeroY = yCents(0);

  const anchorsInView = chartAnchorsHz.filter((h) => h > 0).slice(0, 22);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-primary/6 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
        <p>
          <span className="font-medium text-foreground/90">Which chart?</span> Your setup column from the
          printed 22-shruti table:{" "}
          <span className="font-medium text-emerald-700 dark:text-emerald-400">{chartColumnTitle}</span>.
          Nearest of your 22 chart frequencies; green within ±{CREPE_DISPLAY_HIT_CENTS}¢.
        </p>
        <p className="mt-1.5">
          Green = within ±{CREPE_DISPLAY_HIT_CENTS}¢ of a chart dot after correction. Red = farther off.
          Trust your ear — pitch trackers are not perfect.
        </p>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-foreground/90">
          How close to the chart dots (cents)
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          On target = near the center line. Red = farther from the nearest of your 22 chart frequencies.
        </p>
        <div className="relative h-52 w-full rounded-xl border border-primary/10 bg-card/50 p-2 shadow-inner md:h-64">
          <svg
            viewBox={`0 0 ${VB.w} ${VB.h}`}
            className="h-full w-full"
            role="img"
            aria-label="Cents deviation from nearest chart shruti over time"
          >
            <rect x={VB.ml} y={VB.mt} width={plotW} height={plotH} fill="hsl(var(--muted) / 0.2)" rx={4} />
            <rect
              x={VB.ml}
              y={Math.min(bandTop, bandBottom)}
              width={plotW}
              height={Math.abs(bandBottom - bandTop)}
              fill={BAND_FILL}
            />
            <line
              x1={VB.ml}
              x2={VB.ml + plotW}
              y1={zeroY}
              y2={zeroY}
              stroke={TARGET_LINE}
              strokeWidth={1.5}
              opacity={0.85}
            />
            {yTicksC.map((c) => (
              <g key={`yc-${c}`}>
                <line
                  x1={VB.ml}
                  x2={VB.ml + plotW}
                  y1={yCents(c)}
                  y2={yCents(c)}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                  opacity={c === 0 ? 0 : 0.55}
                />
                <text
                  x={VB.ml - 6}
                  y={yCents(c)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill="var(--muted-foreground)"
                >
                  {c > 0 ? `+${c}` : c}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text
                key={`xt-${t}`}
                x={xScale(t)}
                y={VB.h - 10}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {formatPracticeShrutiTime(t)}
              </text>
            ))}
            <text
              x={14}
              y={VB.mt + plotH / 2}
              textAnchor="middle"
              fontSize={11}
              fill="var(--muted-foreground)"
              transform={`rotate(-90, 14, ${VB.mt + plotH / 2})`}
            >
              ¢ from nearest chart dot
            </text>

            {dots.map((p, i) => (
              <circle
                key={`c-${i}`}
                cx={xScale(p.t)}
                cy={yCents(p.cents)}
                r={3.5}
                fill={p.onShruti ? SING_ON : SING_OFF}
                stroke="hsl(var(--background))"
                strokeWidth={0.5}
                opacity={0.92}
                onMouseEnter={() =>
                  setHover({
                    x: xScale(p.t),
                    y: yCents(p.cents),
                    label: `${p.cents >= 0 ? "+" : ""}${p.cents.toFixed(1)}¢ · shruti ${p.shruti22} · ${p.hz.toFixed(1)} Hz`,
                  })
                }
                onMouseLeave={() => setHover(null)}
              />
            ))}
            {hover && (
              <g pointerEvents="none">
                <rect
                  x={Math.min(hover.x + 8, VB.w - 200)}
                  y={Math.max(hover.y - 28, 4)}
                  width={192}
                  height={24}
                  rx={5}
                  fill="hsl(var(--popover))"
                  stroke="var(--border)"
                />
                <text
                  x={Math.min(hover.x + 14, VB.w - 192)}
                  y={Math.max(hover.y - 12, 20)}
                  fontSize={10}
                  fill="hsl(var(--popover-foreground))"
                >
                  {hover.label}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-foreground/90">Pitch vs chart column (Hz)</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Green lines = the 22 target frequencies in {chartColumnTitle}. Your dots should sit on a line
          when in tune.
        </p>
        <HzPlot
          dots={dots}
          anchors={anchorsInView}
          maxT={maxT}
          xScale={xScale}
          hover={hover}
          setHover={setHover}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded" style={{ background: TARGET_LINE }} />
          Chart targets (22 lines)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: SING_ON }} />
          You ±{CREPE_DISPLAY_HIT_CENTS}¢
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: SING_OFF }} />
          You off target
        </span>
      </div>
    </div>
  );
}

function HzPlot({
  dots,
  anchors,
  maxT,
  xScale,
  hover,
  setHover,
}: {
  dots: PracticePitchDot[];
  anchors: number[];
  maxT: number;
  xScale: (t: number) => number;
  hover: { x: number; y: number; label: string } | null;
  setHover: (h: { x: number; y: number; label: string } | null) => void;
}) {
  const plotW = VB.w - VB.ml - VB.mr;
  const plotH = 140;
  const vbH = plotH + VB.mt + VB.mb;
  const hzVals = [...dots.map((d) => d.hz), ...anchors];
  const [yMin, yMax] =
    hzVals.length > 0
      ? (() => {
          const min = Math.min(...hzVals);
          const max = Math.max(...hzVals);
          const span = Math.max(max - min, 60);
          return [Math.max(80, min - span * 0.08), Math.min(2000, max + span * 0.1)] as [number, number];
        })()
      : ([200, 600] as [number, number]);

  const yScale = (hz: number) => VB.mt + plotH - ((hz - yMin) / (yMax - yMin)) * plotH;

  return (
    <div className="h-40 w-full rounded-xl border border-primary/10 bg-card/50 p-2">
      <svg viewBox={`0 0 ${VB.w} ${vbH}`} className="h-full w-full">
        <rect x={VB.ml} y={VB.mt} width={plotW} height={plotH} fill="hsl(var(--muted) / 0.2)" rx={4} />
        {anchors.map((hz, i) => (
          <line
            key={`ah-${i}`}
            x1={VB.ml}
            x2={VB.ml + plotW}
            y1={yScale(hz)}
            y2={yScale(hz)}
            stroke={TARGET_LINE}
            strokeWidth={1}
            strokeOpacity={0.55}
          />
        ))}
        {dots.map((p, i) => (
          <circle
            key={`h-${i}`}
            cx={xScale(p.t)}
            cy={yScale(p.hz)}
            r={3}
            fill={p.onShruti ? SING_ON : SING_OFF}
            stroke="hsl(var(--background))"
            strokeWidth={0.5}
            onMouseEnter={() =>
              setHover({
                x: xScale(p.t),
                y: yScale(p.hz),
                label: `${p.hz.toFixed(2)} Hz · shruti ${p.shruti22}`,
              })
            }
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={VB.w - 68} y={VB.mt + 10} fontSize={9} fill="var(--muted-foreground)">
          {Math.round(yMax)} Hz
        </text>
        <text x={VB.w - 68} y={VB.mt + plotH} fontSize={9} fill="var(--muted-foreground)">
          {Math.round(yMin)} Hz
        </text>
      </svg>
    </div>
  );
}
