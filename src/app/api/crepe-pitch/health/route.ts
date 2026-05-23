import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.CREPE_PITCH_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({ ok: false, error: "CREPE_PITCH_URL is not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "CREPE service unreachable" }, { status: 503 });
  }
}
