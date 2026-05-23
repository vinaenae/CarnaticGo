import { NextResponse } from "next/server";

export const maxDuration = 600;
export const runtime = "nodejs";

/** Proxies multi-file WAV upload to Python CREPE batch endpoint. */
export async function POST(req: Request) {
  const base = process.env.CREPE_PITCH_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "CREPE_PITCH_URL is not configured" },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const upstream = new FormData();

  for (const key of ["ref", "user"] as const) {
    const file = form.get(key);
    if (file instanceof Blob) {
      upstream.append(key, file, `${key}.wav`);
    }
  }

  const upstreamRes = await fetch(`${base}/analyze/batch`, {
    method: "POST",
    body: upstream,
  });

  const text = await upstreamRes.text();
  return new NextResponse(text, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": upstreamRes.headers.get("Content-Type") ?? "application/json",
    },
  });
}
