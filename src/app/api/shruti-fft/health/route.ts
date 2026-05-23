import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.SHRUTI_FFT_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({ ok: false, error: "SHRUTI_FFT_URL is not configured" }, { status: 503 });
  }
  try {
    const upstream = await fetch(`${base}/health`, { next: { revalidate: 0 } });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "shruti-fft unreachable" }, { status: 502 });
  }
}
