"use client";

import { useCallback, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MergedPitchChartRow } from "@/lib/audio/pitchContour";
import type { AiPitchSummaryResult } from "@/lib/singalong/ai-pitch-summary-types";
import { downsampleChartForGemini } from "@/lib/singalong/gemini-chart-payload";

type AiPitchSummaryProps = {
  chartData: MergedPitchChartRow[];
  durationSec: number;
  /** Optional text from rule-based analysis to steer the model. */
  algorithmicHints?: string;
  disabled?: boolean;
};

export function AiPitchSummary({
  chartData,
  durationSec,
  algorithmicHints,
  disabled,
}: AiPitchSummaryProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiPitchSummaryResult | null>(null);

  const runAiSummary = useCallback(async () => {
    if (chartData.length < 4) return;
    setLoading(true);
    setError(null);
    try {
      const chart = downsampleChartForGemini(chartData);
      const res = await fetch("/api/sing-along/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chart,
          durationSec,
          algorithmicHints,
        }),
      });
      const data = (await res.json()) as AiPitchSummaryResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "AI summary failed.");
      }
      setResult({ summary: data.summary, mistakes: data.mistakes ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI summary failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [algorithmicHints, chartData, durationSec]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" aria-hidden />
          AI summary
        </CardTitle>
        <CardDescription>Compares your pitch to the teacher</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || loading || chartData.length < 4}
          onClick={() => void runAiSummary()}
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              Generate AI summary
            </>
          )}
        </Button>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {result ? (
          <div className="space-y-4 rounded-xl border border-border bg-primary/6 p-4 text-sm">
            <p className="leading-relaxed text-foreground">{result.summary}</p>
            {result.mistakes.length > 0 ? (
              <ul className="space-y-4 border-t border-border/60 pt-4">
                {result.mistakes.map((m, i) => (
                  <li key={i} className="space-y-1">
                    <p className="font-medium text-foreground">{m.timestamp}</p>
                    <p className="text-muted-foreground">{m.issue}</p>
                    {m.fix ? (
                      <p className="text-foreground">
                        <span className="font-medium">Try:</span> {m.fix}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : result.summary.trim().toLowerCase().includes("on point") ? null : (
              <p className="border-t border-border/60 pt-3 text-muted-foreground">
                No major issues flagged — keep listening back and comparing on the chart.
              </p>
            )}
            <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
              AI guidance is approximate; confirm with your ear and the pitch graph.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
