"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  defaultPracticeConfig,
  readPracticeConfig,
  writePracticeConfig,
  type ResolvedPracticeConfig,
} from "@/lib/practice-storage";
import { isPracticeModeId, type PracticeModeId } from "@/lib/practice-modes";
import { getTanpuraService } from "@/lib/audio/TanpuraService";
import { Skeleton } from "@/components/ui/skeleton";
import { ClaudeShrutiStabilizer } from "@/components/practice/ClaudeShrutiStabilizer";
import { HoldSwaraExercise } from "@/components/practice/HoldSwaraExercise";
import { TalaHandTracker } from "@/components/practice/TalaHandTracker";
import { WarmupSongPractice } from "@/components/practice/WarmupSongPractice";

function resolvePracticeMode(
  modeParam: string | null,
  config: ResolvedPracticeConfig | null,
): PracticeModeId {
  if (modeParam && isPracticeModeId(modeParam)) return modeParam;
  if (config?.practiceMode && isPracticeModeId(config.practiceMode)) {
    return config.practiceMode;
  }
  return "warmup";
}

export function PracticeLiveClient({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [cfg, setCfg] = useState<ResolvedPracticeConfig | null>(null);

  const practiceMode = useMemo(
    () => resolvePracticeMode(searchParams.get("mode"), cfg),
    [searchParams, cfg],
  );

  const warmupView = searchParams.get("view");

  useEffect(() => {
    let config = readPracticeConfig(sessionId);
    if (!config) {
      config = defaultPracticeConfig();
      writePracticeConfig(sessionId, config);
    }
    const mode = resolvePracticeMode(searchParams.get("mode"), config);
    if (config.practiceMode !== mode) {
      config = { ...config, practiceMode: mode };
      writePracticeConfig(sessionId, config);
    }
    setCfg(config);
    setReady(true);
  }, [sessionId, searchParams]);

  useEffect(() => {
    void getTanpuraService().preload();
  }, []);

  if (!ready || !cfg) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {practiceMode === "warmup" && warmupView === "song" ? (
        <WarmupSongPractice
          sessionId={sessionId}
          tanpuraKey={searchParams.get("shruti") ?? cfg.tanpuraKey}
          ragaId={searchParams.get("raga") ?? cfg.ragaId}
        />
      ) : practiceMode === "warmup" ? (
        <ClaudeShrutiStabilizer
          sessionId={sessionId}
          initialTanpuraKey={searchParams.get("shruti") ?? cfg.tanpuraKey}
          initialRagaId={searchParams.get("raga") ?? cfg.ragaId}
        />
      ) : practiceMode === "hold-swara" ? (
        <HoldSwaraExercise
          initialTanpuraKey={searchParams.get("shruti") ?? cfg.tanpuraKey}
          sessionId={sessionId}
        />
      ) : practiceMode === "tala" ? (
        <TalaHandTracker />
      ) : null}
    </div>
  );
}
