import { NextResponse } from "next/server";

/** Proxies JSON mic frame to Python CREPE for live practice shruti meter. */
export async function POST(req: Request) {
  const base = process.env.CREPE_PITCH_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "CREPE_PITCH_URL is not configured" },
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
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
