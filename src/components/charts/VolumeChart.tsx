"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VolumeSample } from "@/types";

const WINDOW = 100;

/** Center each window on its mean so a steady level reads as a flat line at 0. */
function buildRows(data: VolumeSample[]) {
  const slice = data.slice(-WINDOW);
  if (slice.length === 0) return [];
  const mean = slice.reduce((a, d) => a + d.rms, 0) / slice.length;
  return slice.map((d, i) => ({
    i,
    v: d.rms - mean,
  }));
}

export function VolumeChart({ data }: { data: VolumeSample[] }) {
  const rows = buildRows(data);

  return (
    <div className="h-48 w-full rounded-xl border border-primary/10 bg-card/50 p-2 shadow-inner md:h-56 md:p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.85} />
          <XAxis dataKey="i" tick={false} axisLine={false} height={4} />
          <YAxis
            width={36}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => (Math.abs(Number(v)) < 1e-6 ? "" : String(v))}
            label={{
              value: "Louder / softer",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: "var(--muted-foreground)" },
            }}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" opacity={0.7} />
          <Tooltip
            formatter={(val) => {
              const n = typeof val === "number" ? val : Number(val);
              if (!Number.isFinite(n)) return ["—", ""];
              const t = Math.abs(n) < 0.002 ? "Nice and steady" : n > 0 ? "Louder here" : "Softer here";
              return [t, ""];
            }}
            labelFormatter={() => ""}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke="var(--chart-2)"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Line is how much you drifted from your average level — flat means even volume.
      </p>
    </div>
  );
}
