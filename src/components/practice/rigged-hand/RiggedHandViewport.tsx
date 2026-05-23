"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { TalaCountFinger, TalaGesture } from "@/lib/carnatic-tala";
import { talaGestureToLandmarks } from "@/lib/hand-rig/tala-pose-landmarks";
import styles from "@/components/practice/TalaHand3D.module.css";

const RiggedHandCanvas = dynamic(
  () =>
    import("@/components/practice/rigged-hand/RiggedHandCanvas").then(
      (m) => m.RiggedHandCanvas,
    ),
  { ssr: false, loading: () => <div className={styles.handLoading} aria-hidden /> },
);

function gestureRotation(gesture: TalaGesture): [number, number, number] {
  if (gesture === "wave") return [0.22, 2.55, 0.02];
  if (gesture === "count") return [0.28, -0.48, -0.02];
  return [0.26, -0.52, -0.01];
}

export function RiggedHandViewport({
  gesture,
  raisedFinger,
  countFinger,
  pulse,
}: {
  gesture: TalaGesture;
  raisedFinger: number | null;
  countFinger?: TalaCountFinger;
  pulse: number;
}) {
  const landmarks = useMemo(
    () => talaGestureToLandmarks(gesture, countFinger, raisedFinger),
    [gesture, countFinger, raisedFinger, pulse],
  );
  const rot = useMemo(() => gestureRotation(gesture), [gesture]);

  return (
    <RiggedHandCanvas landmarks={landmarks} gestureRotation={rot} pulse={pulse} />
  );
}
