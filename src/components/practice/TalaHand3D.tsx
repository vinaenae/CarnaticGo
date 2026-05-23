"use client";

import { Fragment } from "react";
import styles from "@/components/practice/TalaHand3D.module.css";
import { cn } from "@/lib/utils";
import type { TalaGesture } from "@/lib/carnatic-tala";

type DigitId = "thumb" | "index" | "middle" | "ring" | "pinky";
type SegmentClass = "segmentProx" | "segmentMid" | "segmentDist";

const DIGITS: {
  id: DigitId;
  segments: number;
  raisedIndex: number;
}[] = [
  { id: "thumb", segments: 2, raisedIndex: 0 },
  { id: "index", segments: 3, raisedIndex: 1 },
  { id: "middle", segments: 3, raisedIndex: 2 },
  { id: "ring", segments: 3, raisedIndex: 3 },
  { id: "pinky", segments: 3, raisedIndex: 4 },
];

function SegmentBridge() {
  return <span className={styles.segmentBridge} aria-hidden />;
}

function FingerChain({ segmentCount }: { segmentCount: number }) {
  const segments: SegmentClass[] =
    segmentCount === 2
      ? ["segmentDist", "segmentProx"]
      : ["segmentDist", "segmentMid", "segmentProx"];

  return (
    <div className={styles.fingerChain}>
      {segments.map((seg, i) => (
        <Fragment key={seg}>
          {i > 0 ? <SegmentBridge /> : null}
          <div className={styles.segmentWrap}>
            {seg !== "segmentDist" ? <span className={styles.joint} aria-hidden /> : null}
            <span className={cn(styles.segment, styles[seg])} />
            {seg === "segmentDist" ? <span className={styles.nail} /> : null}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function TalaHand3D({
  gesture,
  raisedFinger,
  pulse,
}: {
  gesture: TalaGesture;
  raisedFinger: number | null;
  pulse: number;
}) {
  const pose =
    gesture === "wave"
      ? styles.handWave
      : gesture === "count"
        ? styles.handCount
        : styles.handClap;

  return (
    <div className={styles.scene} aria-hidden>
      <div className={styles.shadow} />
      <div key={pulse} className={cn(styles.hand, pose, styles.handPulse)}>
        <div className={styles.forearm} />
        <div className={styles.wrist} />

        <div className={styles.palmUnit}>
          <div className={styles.palmPalmar}>
            <span className={styles.crease} />
            <span className={cn(styles.crease, styles.crease2)} />
            <span className={cn(styles.crease, styles.crease3)} />
            <span className={styles.thenarPad} />
            <span className={styles.hypothenarPad} />
          </div>
          <div className={styles.palmDorsal}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={styles.dorsalKnuckle}
                style={{ left: `${18 + i * 22}%` }}
              />
            ))}
          </div>
        </div>

        <div className={styles.thumbMount}>
          <div
            className={cn(
              styles.digit,
              styles.thumb,
              raisedFinger === 0 && styles.digitRaised,
            )}
          >
            <span className={styles.metacarpal} />
            <SegmentBridge />
            <FingerChain segmentCount={2} />
          </div>
        </div>

        <div className={styles.digitsRow}>
          {DIGITS.filter((d) => d.id !== "thumb").map((d) => (
            <div
              key={d.id}
              className={cn(
                styles.digit,
                styles[d.id],
                raisedFinger === d.raisedIndex && styles.digitRaised,
              )}
            >
              <span className={styles.metacarpal} />
              <SegmentBridge />
              <FingerChain segmentCount={d.segments} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
