"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  parseScaleQuizMode,
  scaleQuizModeLabel,
} from "@/components/melakarta/ScaleQuizClient";

export function ScaleQuizPageHeader() {
  const searchParams = useSearchParams();
  const mode = parseScaleQuizMode(searchParams.get("mode"));
  const title = scaleQuizModeLabel(mode);

  return (
    <div>
      <Link
        href="/melakarta"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        ← Melakarta
      </Link>
      <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
    </div>
  );
}
