import { NextResponse } from "next/server";
import { buildGeminiPitchSummaryPrompt } from "@/lib/singalong/gemini-pitch-summary-prompt";
import { parseAiPitchSummaryResponse } from "@/lib/singalong/parse-ai-pitch-summary";
import type { SingAlongAiSummaryRequest } from "@/lib/singalong/ai-pitch-summary-types";

export const maxDuration = 120;
export const runtime = "nodejs";

const MODEL_FALLBACKS = ["gpt-4o-mini", "gpt-4o"] as const;

function modelsToTry(): string[] {
  const configured = process.env.OPENAI_MODEL?.trim();
  const list = configured ? [configured, ...MODEL_FALLBACKS] : [...MODEL_FALLBACKS];
  return [...new Set(list)];
}

type OpenAIChatResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured. Add it to .env.local." },
      { status: 503 },
    );
  }

  let body: SingAlongAiSummaryRequest;
  try {
    body = (await req.json()) as SingAlongAiSummaryRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.chart) || body.chart.length < 4) {
    return NextResponse.json(
      { error: "Chart data is too short for analysis." },
      { status: 400 },
    );
  }

  const prompt = buildGeminiPitchSummaryPrompt({
    chart: body.chart,
    durationSec: body.durationSec,
    algorithmicHints: body.algorithmicHints,
  });

  let lastError = "OpenAI API error.";
  let lastStatus = 502;

  for (const model of modelsToTry()) {
    let upstream: Response;
    try {
      upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.35,
          response_format: { type: "json_object" },
        }),
      });
    } catch {
      return NextResponse.json(
        { error: "Could not reach OpenAI API." },
        { status: 502 },
      );
    }

    const raw = (await upstream.json()) as OpenAIChatResponse;

    if (!upstream.ok) {
      lastError = raw.error?.message ?? `OpenAI API error (${upstream.status})`;
      lastStatus = upstream.status;
      const tryNext =
        upstream.status === 404 ||
        /does not exist|not found|invalid_model|model_not_found/i.test(lastError);
      if (tryNext) continue;
      return NextResponse.json({ error: lastError }, { status: lastStatus });
    }

    const text = raw.choices?.[0]?.message?.content;
    if (!text) {
      lastError = "OpenAI returned an empty response.";
      lastStatus = 502;
      continue;
    }

    try {
      const result = parseAiPitchSummaryResponse(text);
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to parse model output.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  return NextResponse.json({ error: lastError }, { status: lastStatus });
}
