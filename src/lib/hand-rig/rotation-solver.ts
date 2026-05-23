import type { HandBoneName } from "@/lib/hand-rig/landmarks";
import {
  directionToQuaternion,
  multiplyQuaternions,
  normalizeQuaternion,
  segmentDirection,
  slerpQuaternion,
} from "@/lib/hand-rig/math";
import type { HandLandmark } from "@/lib/hand-rig/landmarks";
import { HAND_BONE_LANDMARK_SEGMENTS } from "@/lib/hand-rig/landmarks";
import { clampFingerLocalRotation } from "@/lib/hand-rig/constraints";

export type BoneBindPose = {
  localQuat: [number, number, number, number];
  aimDirection: [number, number, number];
};

export type BoneRotations = Map<HandBoneName, [number, number, number, number]>;

const TIP_BONES: ReadonlySet<HandBoneName> = new Set([
  "thumb-tip",
  "index-finger-tip",
  "middle-finger-tip",
  "ring-finger-tip",
  "pinky-finger-tip",
]);

/** Compute target local bone quaternions from 21 model-space landmarks. */
export function solveBoneRotationsFromLandmarks(
  landmarks: HandLandmark[],
  bindPoses: ReadonlyMap<HandBoneName, BoneBindPose>,
): BoneRotations {
  const out: BoneRotations = new Map();

  for (const [boneName, segment] of Object.entries(HAND_BONE_LANDMARK_SEGMENTS) as [
    HandBoneName,
    readonly [number, number],
  ][]) {
    if (TIP_BONES.has(boneName)) continue;

    const bind = bindPoses.get(boneName);
    if (!bind) continue;

    const dir = segmentDirection(landmarks, segment[0], segment[1]);
    if (!dir) {
      out.set(boneName, bind.localQuat);
      continue;
    }

    const delta = directionToQuaternion(bind.aimDirection, dir);
    let local = multiplyQuaternions(delta, bind.localQuat);
    local = clampFingerLocalRotation(boneName, local);
    out.set(boneName, normalizeQuaternion(local));
  }

  return out;
}

export class BoneRotationSmoother {
  private readonly state = new Map<HandBoneName, [number, number, number, number]>();
  private readonly alpha: number;

  constructor(smoothing = 0.22) {
    this.alpha = Math.min(1, Math.max(0.05, smoothing));
  }

  smooth(target: BoneRotations): BoneRotations {
    const out: BoneRotations = new Map();
    for (const [name, quat] of target) {
      const prev = this.state.get(name);
      const next = prev
        ? normalizeQuaternion(slerpQuaternion(prev, quat, this.alpha))
        : quat;
      this.state.set(name, next);
      out.set(name, next);
    }
    return out;
  }

  reset() {
    this.state.clear();
  }
}
