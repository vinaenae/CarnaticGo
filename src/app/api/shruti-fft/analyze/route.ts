import { NextResponse } from "next/server";

/** Proxies JSON audio frame to Python shruti-fft service (RFFT → swara). */
export async function POST(req: Request) {
  const base = process.env.SHRUTI_FFT_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "SHRUTI_FFT_URL is not configured" },
      { status: 503 },
    );
  }

  const body = await req.text();
  const upstream = await fetch(`${base}/analyze/frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
