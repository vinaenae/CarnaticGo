"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { createClientSessionId } from "@/lib/id";
import { isPracticeModeId, PRACTICE_SESSION_FLOW } from "@/lib/practice-modes";
import { defaultPracticeConfig, writePracticeConfig } from "@/lib/practice-storage";

export function PracticeStartRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    const mode = modeParam && isPracticeModeId(modeParam) ? modeParam : "warmup";
    const flow = searchParams.get("flow");
    const sessionId = createClientSessionId();
    writePracticeConfig(sessionId, defaultPracticeConfig({ practiceMode: mode }));
    const q = new URLSearchParams({ mode });
    if (flow === PRACTICE_SESSION_FLOW) q.set("flow", PRACTICE_SESSION_FLOW);
    router.replace(`/practice/${sessionId}/live?${q.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
