"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildPracticeRagaTargets, type PracticeRagaTargets } from "@/lib/practice-raga-scale";
import type { ScaleQuizRaga } from "@/lib/scale-quiz-ragas";

function ScaleLine({
  label,
  line,
  steps,
}: {
  label: string;
  line: string;
  steps: PracticeRagaTargets["arohanamSteps"];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-heading text-lg tracking-wide text-foreground">{line}</p>
      <div className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <span
            key={`${label}-${i}-${s.token}`}
            className="inline-flex flex-col items-center rounded-md border border-primary/15 bg-primary/8 px-2 py-1 text-center"
          >
            <span className="text-sm font-medium text-foreground">{s.token}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{s.hz.toFixed(1)} Hz</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function PracticeRagaScaleCard({
  raga,
  saHz,
  shrutiLabel,
}: {
  raga: ScaleQuizRaga;
  saHz: number;
  shrutiLabel: string;
}) {
  const targets = useMemo(() => buildPracticeRagaTargets(raga, saHz), [raga, saHz]);

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{raga.name}</CardTitle>
        <CardDescription>
          Sa {saHz.toFixed(2)} Hz ({shrutiLabel}) · targets from swara ratios × Sa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ScaleLine label="Arohanam" line={raga.arohanam} steps={targets.arohanamSteps} />
        <ScaleLine label="Avarohanam" line={raga.avarohanam} steps={targets.avarohanamSteps} />
      </CardContent>
    </Card>
  );
}
