import type { AiPitchMistake, AiPitchSummaryResult } from "@/lib/singalong/ai-pitch-summary-types";

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) return JSON.parse(fence[1].trim());
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON.");
  }
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function parseMistakes(raw: unknown): AiPitchMistake[] {
  if (!Array.isArray(raw)) return [];
  const out: AiPitchMistake[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const timestamp = asString(m.timestamp);
    const issue = asString(m.issue);
    const fix = asString(m.fix);
    if (!timestamp && !issue) continue;
    out.push({ timestamp, issue, fix });
  }
  return out.slice(0, 8);
}

export function parseAiPitchSummaryResponse(text: string): AiPitchSummaryResult {
  const parsed = extractJsonObject(text) as Record<string, unknown>;
  const summary = asString(parsed.summary);
  if (!summary) {
    throw new Error("Model JSON missing summary field.");
  }
  return {
    summary,
    mistakes: parseMistakes(parsed.mistakes),
  };
}
