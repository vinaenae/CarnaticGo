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
import type { TempoSample } from "@/types";

const WINDOW = 80;

function hint(ms: number) {
  const a = Math.abs(ms);
  if (a < 40) return "With the beat";
  if (ms < 0) return "Ahead — slow down a touch";
  return "Behind — speed up a touch";
}

export function TempoOffsetChart({ data }: { data: TempoSample[] }) {
  const slice = data.slice(-WINDOW);
  const rows = slice.map((d, i) => ({
    i,
    v: Number.isFinite(d.offsetMs) ? d.offsetMs : null,
  }));

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
            label={{
              value: "Early / late",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: "var(--muted-foreground)" },
            }}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" opacity={0.7} />
          <Tooltip
            formatter={(val) => {
              const n = typeof val === "number" ? val : Number(val);
              return [Number.isFinite(n) ? hint(n) : "—", ""];
            }}
            labelFormatter={() => ""}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke="var(--chart-3)"
            dot={false}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        A flat line on the middle means you stayed with the clicks you set.
      </p>
    </div>
  );
}
