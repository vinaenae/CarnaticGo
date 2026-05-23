import { NextResponse } from "next/server";

/** Proxies multipart audio to the Python tonic-detector service. */
export async function POST(req: Request) {
  const base = process.env.TONIC_DETECTOR_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "TONIC_DETECTOR_URL is not configured" },
      { status: 503 },
    );
  }

  const form = await req.formData();
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/detect/tonic`, {
      method: "POST",
      body: form,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Tonic detector is not running on port 8004. Stop dev and run `npm run dev` again — it starts the tonic service automatically.",
      },
      { status: 503 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
