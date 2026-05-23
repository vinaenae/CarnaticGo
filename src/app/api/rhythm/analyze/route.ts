import { NextResponse } from "next/server";

/**
 * Proxies multipart audio + BPM/tala to the Python librosa service so the browser stays same-origin.
 * Set `RHYTHM_ANALYSIS_URL` (e.g. http://127.0.0.1:8000) in `.env.local`.
 */
export async function POST(req: Request) {
  const base = process.env.RHYTHM_ANALYSIS_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "RHYTHM_ANALYSIS_URL is not configured" },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const upstream = await fetch(`${base}/analyze/rhythm`, {
    method: "POST",
    body: form,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
