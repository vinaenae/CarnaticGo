import type { HandLandmark, HandLandmarks } from "@/lib/hand-rig/landmarks";
import {
  MP_INDEX_MCP,
  MP_INDEX_TIP,
  MP_MIDDLE_MCP,
  MP_MIDDLE_TIP,
  MP_PINKY_MCP,
  MP_PINKY_TIP,
  MP_RING_MCP,
  MP_RING_TIP,
  MP_THUMB_TIP,
} from "@/lib/hand-rig/landmarks";
import type { TalaCountFinger, TalaGesture } from "@/lib/carnatic-tala";

const FINGER_TIP: Record<TalaCountFinger, number> = {
  thumb: MP_THUMB_TIP,
  index: MP_INDEX_TIP,
  middle: MP_MIDDLE_TIP,
  ring: MP_RING_TIP,
  pinky: MP_PINKY_TIP,
};

const FINGER_MCP: Record<TalaCountFinger, number> = {
  thumb: 2,
  index: MP_INDEX_MCP,
  middle: MP_MIDDLE_MCP,
  ring: MP_RING_MCP,
  pinky: MP_PINKY_MCP,
};

function lm(x: number, y: number, z: number): HandLandmark {
  return { x, y, z };
}

function baseOpenHand(): HandLandmark[] {
  return [
    lm(0, 0, 0),
    lm(-0.03, 0.02, 0.03),
    lm(-0.04, 0.05, 0.04),
    lm(-0.045, 0.08, 0.045),
    lm(-0.05, 0.11, 0.05),
    lm(-0.02, 0.04, 0),
    lm(-0.02, 0.09, 0),
    lm(-0.02, 0.13, 0),
    lm(-0.02, 0.16, 0),
    lm(0, 0.04, 0),
    lm(0, 0.1, 0),
    lm(0, 0.14, 0),
    lm(0, 0.17, 0),
    lm(0.02, 0.04, 0),
    lm(0.02, 0.09, 0),
    lm(0.02, 0.13, 0),
    lm(0.02, 0.16, 0),
    lm(0.04, 0.035, 0),
    lm(0.045, 0.07, 0),
    lm(0.048, 0.1, 0),
    lm(0.05, 0.12, 0),
  ];
}

function curlFinger(
  points: HandLandmark[],
  mcp: number,
  pip: number,
  dip: number,
  tip: number,
  amount: number,
) {
  const p = points[mcp]!;
  points[pip] = lm(p.x, p.y + 0.02 * (1 - amount), p.z);
  points[dip] = lm(p.x, p.y + 0.05 * (1 - amount), p.z);
  points[tip] = lm(p.x, p.y + 0.07 * (1 - amount), p.z);
}

function extendFinger(points: HandLandmark[], finger: TalaCountFinger, lift = 0.14) {
  const mcp = FINGER_MCP[finger];
  const tip = FINGER_TIP[finger];
  const p = points[mcp]!;
  points[tip] = lm(p.x, p.y + lift, p.z - 0.02);
  if (finger === "thumb") {
    points[2] = lm(p.x - 0.01, p.y + lift * 0.45, p.z + 0.02);
    points[3] = lm(p.x - 0.015, p.y + lift * 0.75, p.z + 0.03);
  } else {
    const pip = mcp + 1;
    const dip = mcp + 2;
    points[pip] = lm(p.x, p.y + lift * 0.55, p.z);
    points[dip] = lm(p.x, p.y + lift * 0.8, p.z);
  }
}

export function talaGestureToLandmarks(
  gesture: TalaGesture,
  countFinger: TalaCountFinger | undefined,
  raisedFingerIndex: number | null,
): HandLandmarks {
  const pts = baseOpenHand();

  if (gesture === "clap") {
    for (const f of ["index", "middle", "ring", "pinky"] as TalaCountFinger[]) {
      const mcp = FINGER_MCP[f];
      curlFinger(pts, mcp, mcp + 1, mcp + 2, FINGER_TIP[f], 0.85);
    }
    curlFinger(pts, 1, 2, 3, MP_THUMB_TIP, 0.5);
    return pts;
  }

  if (gesture === "wave") {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      pts[i] = lm(p.x + 0.02, p.y, p.z - 0.04);
    }
    return pts;
  }

  const fingerMap: TalaCountFinger[] = ["thumb", "index", "middle", "ring", "pinky"];
  const raised =
    countFinger ??
    (raisedFingerIndex != null && raisedFingerIndex >= 0 && raisedFingerIndex < 5
      ? fingerMap[raisedFingerIndex]
      : undefined);

  for (const f of fingerMap) {
    const mcp = FINGER_MCP[f];
    curlFinger(pts, mcp, mcp + 1, mcp + 2, FINGER_TIP[f], 0.9);
  }

  if (raised) {
    extendFinger(pts, raised, 0.16);
  }

  return pts;
}
