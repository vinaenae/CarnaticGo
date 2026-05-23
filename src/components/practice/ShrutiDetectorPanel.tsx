"use client";

import { useCallback, useMemo, useRef } from "react";
import { useWarmupShrutiDrift } from "@/hooks/useWarmupShrutiDrift";
import styles from "@/components/practice/ShrutiDetectorPanel.module.css";
import { cn } from "@/lib/utils";

const PLAY_SA_DURATION_SEC = 4;

function playSaTone(ctx: AudioContext, freq: number, dur: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const attack = Math.min(0.03, dur * 0.2);
  const release = Math.min(0.1, dur * 0.35);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + attack);
  gain.gain.setValueAtTime(0.35, ctx.currentTime + dur - release);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

export function ShrutiDetectorPanel({
  saHz,
  enabled,
  onEnabledChange,
  hasPitch,
  inTune,
  onRagaHintActive,
  onShrutiHintActive,
  fillHeight = false,
}: {
  saHz: number;
  enabled: boolean;
  onEnabledChange: (on: boolean) => void;
  hasPitch: boolean;
  inTune: boolean;
  /** Highlights the selected rāga in the session meta bar. */
  onRagaHintActive?: (active: boolean) => void;
  /** Highlights the selected shruti in the session meta bar. */
  onShrutiHintActive?: (active: boolean) => void;
  fillHeight?: boolean;
}) {
  const toneCtxRef = useRef<AudioContext | null>(null);

  const { shrutiDetector } = useWarmupShrutiDrift({
    active: enabled,
    hasPitch,
    inTune,
  });

  const statusLabel = useMemo(() => {
    if (!enabled) return null;
    if (shrutiDetector === "on") return "On shruti";
    if (shrutiDetector === "off") return "Off shruti";
    return "Listening…";
  }, [enabled, shrutiDetector]);

  const playSa = useCallback(() => {
    if (!toneCtxRef.current || toneCtxRef.current.state === "closed") {
      toneCtxRef.current = new AudioContext();
    }
    const ctx = toneCtxRef.current;
    void ctx.resume();
    playSaTone(ctx, saHz, PLAY_SA_DURATION_SEC);
  }, [saHz]);

  return (
    <div className={cn(styles.panel, fillHeight && styles.panelFill)}>
      <p className={styles.title}>Shruti detector</p>
      <p className={styles.hint}>
        Sing slowly. Adjust the tāla to be 70 BPM or lower. Make sure to sing in the selected{" "}
        <button
          type="button"
          className={styles.ragaHintLink}
          onMouseEnter={() => onRagaHintActive?.(true)}
          onMouseLeave={() => onRagaHintActive?.(false)}
          onFocus={() => onRagaHintActive?.(true)}
          onBlur={() => onRagaHintActive?.(false)}
          onClick={() => onRagaHintActive?.(true)}
        >
          raga
        </button>
        .
      </p>

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          className={styles.toggleInput}
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span className={styles.toggleLabel}>Use shruti detector</span>
      </label>

      {enabled ? (
        <>
          <button
            type="button"
            className={cn(
              styles.playSaBtn,
              shrutiDetector === "off" && styles.playSaBtnPrompt,
            )}
            onMouseEnter={() => onShrutiHintActive?.(true)}
            onMouseLeave={() => onShrutiHintActive?.(false)}
            onFocus={() => onShrutiHintActive?.(true)}
            onBlur={() => onShrutiHintActive?.(false)}
            onClick={() => {
              onShrutiHintActive?.(true);
              playSa();
            }}
          >
            Play shruti
          </button>
          {statusLabel ? (
            <p
              className={cn(
                styles.status,
                shrutiDetector === "on" && styles.statusOn,
                shrutiDetector === "off" && styles.statusOff,
              )}
              role="status"
              aria-live="polite"
            >
              {statusLabel}
            </p>
          ) : null}
        </>
      ) : (
        <p className={styles.disabledNote}>
          Shruti detector is off — use the full screen for the tāla hand guide.
        </p>
      )}
    </div>
  );
}
