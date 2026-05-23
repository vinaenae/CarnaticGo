"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TempoSample } from "@/types";

export function TempoChart({ data }: { data: TempoSample[] }) {
  const rows = data.map((d) => ({
    t: Number(d.t.toFixed(2)),
    offsetMs: d.offsetMs,
  }));

  return (
    <div className="h-48 w-full md:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="t" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} label={{ value: "ms", angle: -90, position: "insideLeft" }} />
          <Tooltip
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v);
              const label = Number.isFinite(n) ? n.toFixed(0) : "—";
              return [label, "Δ to beat"];
            }}
            labelFormatter={(l) => `t = ${l}s`}
          />
          <Line type="monotone" dataKey="offsetMs" stroke="#9333ea" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
