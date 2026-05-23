import type { HandBoneName } from "@/lib/hand-rig/landmarks";

type Quat = [number, number, number, number];

const FLEX_BONES: ReadonlySet<HandBoneName> = new Set([
  "thumb-phalanx-proximal",
  "thumb-phalanx-distal",
  "index-finger-phalanx-proximal",
  "index-finger-phalanx-intermediate",
  "index-finger-phalanx-distal",
  "middle-finger-phalanx-proximal",
  "middle-finger-phalanx-intermediate",
  "middle-finger-phalanx-distal",
  "ring-finger-phalanx-proximal",
  "ring-finger-phalanx-intermediate",
  "ring-finger-phalanx-distal",
  "pinky-finger-phalanx-proximal",
  "pinky-finger-phalanx-intermediate",
  "pinky-finger-phalanx-distal",
]);

const MAX_FLEX_RAD = (105 * Math.PI) / 180;
const MIN_FLEX_RAD = (-8 * Math.PI) / 180;
const MAX_TWIST_RAD = (22 * Math.PI) / 180;
const MAX_SPREAD_RAD = (35 * Math.PI) / 180;

function quatToEulerZYX(q: Quat): { x: number; y: number; z: number } {
  const [x, y, z, w] = q;
  const sinr = 2 * (w * x + y * z);
  const cosr = 1 - 2 * (x * x + y * y);
  const xAngle = Math.atan2(sinr, cosr);
  const sinp = 2 * (w * y - z * x);
  const yAngle =
    Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);
  const siny = 2 * (w * z + x * y);
  const cosy = 1 - 2 * (y * y + z * z);
  const zAngle = Math.atan2(siny, cosy);
  return { x: xAngle, y: yAngle, z: zAngle };
}

function eulerZYXToQuat(e: { x: number; y: number; z: number }): Quat {
  const cx = Math.cos(e.x / 2);
  const sx = Math.sin(e.x / 2);
  const cy = Math.cos(e.y / 2);
  const sy = Math.sin(e.y / 2);
  const cz = Math.cos(e.z / 2);
  const sz = Math.sin(e.z / 2);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function clampFingerLocalRotation(boneName: HandBoneName, q: Quat): Quat {
  if (!FLEX_BONES.has(boneName)) return q;
  const e = quatToEulerZYX(q);
  e.x = clamp(e.x, MIN_FLEX_RAD, MAX_FLEX_RAD);
  e.y = clamp(e.y, -MAX_SPREAD_RAD, MAX_SPREAD_RAD);
  e.z = clamp(e.z, -MAX_TWIST_RAD, MAX_TWIST_RAD);
  return eulerZYXToQuat(e);
}
