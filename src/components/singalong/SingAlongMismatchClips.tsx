"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  mapRefAxisTimeToUserRecording,
  type DtwChartAlignment,
} from "@/lib/audio/pitchContour";
import {
  formatClipRange,
  type ReferenceMismatchClip,
  type SingAlongClipSections,
} from "@/lib/singalong/mismatch-clips";
import { safePause, safePlay } from "@/lib/audio/safeMediaPlayback";

const SECTION_META: {
  key: keyof SingAlongClipSections;
  title: string;
  empty: string;
}[] = [
  {
    key: "stable",
    title: "Stable swara accuracy",
    empty: "No steady holds where your landing clearly differed from the teacher.",
  },
  {
    key: "contour",
    title: "Pitch contour",
    empty: "No passages where your melodic movement clearly diverged from the reference.",
  },
  {
    key: "flat",
    title: "Flat vs moving",
    empty: "No spans where one side stayed flat while the other moved much more.",
  },
];

type PlayingTarget = { clipId: string; side: "ref" | "user" } | null;

function userTimesForRefSpan(
  alignment: DtwChartAlignment,
  refStartSec: number,
  refEndSec: number,
  userDurationSec: number,
): { start: number; end: number } {
  const start = mapRefAxisTimeToUserRecording(refStartSec, alignment);
  const end = mapRefAxisTimeToUserRecording(refEndSec, alignment);
  const maxT = Number.isFinite(userDurationSec) ? userDurationSec : end;
  return {
    start: Math.max(0, Math.min(start, maxT)),
    end: Math.max(0, Math.min(Math.max(end, start + 0.05), maxT)),
  };
}

function ClipList({
  clips,
  playing,
  canPlayUser,
  onPlayRef,
  onPlayUser,
  onStop,
}: {
  clips: ReferenceMismatchClip[];
  playing: PlayingTarget;
  canPlayUser: boolean;
  onPlayRef: (clip: ReferenceMismatchClip) => void;
  onPlayUser: (clip: ReferenceMismatchClip) => void;
  onStop: () => void;
}) {
  if (clips.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2">
      {clips.map((clip, index) => {
        const refPlaying = playing?.clipId === clip.id && playing.side === "ref";
        const userPlaying = playing?.clipId === clip.id && playing.side === "user";
        return (
          <li
            key={clip.id}
            className="flex flex-col gap-2 rounded-lg border border-border/80 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {index + 1}. {clip.label}
                <span className="ml-2 font-normal text-muted-foreground">
                  ({formatClipRange(clip.refStartSec, clip.refEndSec)})
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{clip.description}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant={refPlaying ? "default" : "secondary"}
                size="sm"
                className="gap-1.5"
                onClick={() => (refPlaying ? onStop() : onPlayRef(clip))}
              >
                {refPlaying ? (
                  <Pause className="size-3.5" aria-hidden />
                ) : (
                  <Play className="size-3.5" aria-hidden />
                )}
                Hear reference
              </Button>
              <Button
                type="button"
                variant={userPlaying ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                disabled={!canPlayUser}
                onClick={() => (userPlaying ? onStop() : onPlayUser(clip))}
              >
                {userPlaying ? (
                  <Pause className="size-3.5" aria-hidden />
                ) : (
                  <Play className="size-3.5" aria-hidden />
                )}
                Hear you
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SingAlongMismatchClips({
  refAudioUrl,
  userAudioUrl,
  alignment,
  sections,
  loading,
}: {
  refAudioUrl: string;
  userAudioUrl: string;
  alignment: DtwChartAlignment | null;
  sections: SingAlongClipSections;
  loading: boolean;
}) {
  const refAudioRef = useRef<HTMLAudioElement>(null);
  const userAudioRef = useRef<HTMLAudioElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState<PlayingTarget>(null);

  const canPlayUser = alignment != null;

  const stopPlayback = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    safePause(refAudioRef.current);
    safePause(userAudioRef.current);
    setPlaying(null);
  }, []);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const scheduleClipEnd = useCallback(
    (el: HTMLAudioElement, endSec: number, clipId: string, side: "ref" | "user") => {
      const onTime = () => {
        if (el.currentTime >= endSec - 0.03) {
          safePause(el);
          el.currentTime = endSec;
          setPlaying(null);
          cleanupRef.current?.();
          cleanupRef.current = null;
        }
      };
      el.addEventListener("timeupdate", onTime);
      cleanupRef.current = () => el.removeEventListener("timeupdate", onTime);
      setPlaying({ clipId, side });
    },
    [],
  );

  const playRefClip = useCallback(
    (clip: ReferenceMismatchClip) => {
      const el = refAudioRef.current;
      if (!el) return;
      stopPlayback();
      safePause(userAudioRef.current);
      el.currentTime = clip.refStartSec;
      void safePlay(el);
      scheduleClipEnd(el, clip.refEndSec, clip.id, "ref");
    },
    [stopPlayback, scheduleClipEnd],
  );

  const playUserClip = useCallback(
    (clip: ReferenceMismatchClip) => {
      const el = userAudioRef.current;
      if (!el || !alignment) return;
      stopPlayback();
      safePause(refAudioRef.current);

      const userDur =
        Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : Number.POSITIVE_INFINITY;
      const mapped = userTimesForRefSpan(
        alignment,
        clip.refStartSec,
        clip.refEndSec,
        userDur,
      );

      let start = clip.userStartSec ?? mapped.start;
      let end = clip.userEndSec ?? mapped.end;
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        start = mapped.start;
        end = mapped.end;
      }
      if (end < start) {
        const swap = start;
        start = end;
        end = swap;
      }

      const playStart = Math.max(0, Math.min(start, userDur - 0.05));
      const playEnd = Math.min(userDur, Math.max(end, playStart + 0.35));
      if (playEnd <= playStart + 0.05) return;

      const beginPlayback = () => {
        el.currentTime = playStart;
        void safePlay(el);
        scheduleClipEnd(el, playEnd, clip.id, "user");
      };

      if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
        beginPlayback();
      } else {
        el.addEventListener("loadedmetadata", beginPlayback, { once: true });
      }
    },
    [alignment, stopPlayback, scheduleClipEnd],
  );

  const totalClips =
    sections.stable.length + sections.contour.length + sections.flat.length;

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-primary/15 bg-primary/6 px-6 py-14"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
        <p className="font-medium text-foreground">Analyzing pitch with CREPE…</p>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Finding reference clips for stable holds, contour, and flat-vs-moving differences.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <audio ref={refAudioRef} src={refAudioUrl} preload="metadata" className="hidden" />
      <audio ref={userAudioRef} src={userAudioUrl} preload="metadata" className="hidden" />

      {totalClips === 0 ? (
        <p className="text-sm text-muted-foreground">
          No clear differences in stable holds, contour, or flat-vs-moving — your take tracks the
          reference closely. Listen to both full clips to double-check by ear.
        </p>
      ) : null}

      {SECTION_META.map(({ key, title, empty }) => {
        const clips = sections[key];
        return (
          <section key={key} className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {clips.length > 0 ? (
              <ClipList
                clips={clips}
                playing={playing}
                canPlayUser={canPlayUser}
                onPlayRef={playRefClip}
                onPlayUser={playUserClip}
                onStop={stopPlayback}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{empty}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
