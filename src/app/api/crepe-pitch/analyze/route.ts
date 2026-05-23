import { NextResponse } from "next/server";

/** Long CREPE runs on full-length clips (up to 8 min in the UI). */
export const maxDuration = 300;
export const runtime = "nodejs";

/** Proxies WAV upload to Python CREPE pitch service. */
export async function POST(req: Request) {
  const base = process.env.CREPE_PITCH_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "CREPE_PITCH_URL is not configured" },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing WAV file" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", file, "clip.wav");

  const upstreamRes = await fetch(`${base}/analyze`, {
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
