import type { HandLandmark, HandLandmarks } from "@/lib/hand-rig/landmarks";

const _tmp = { minLen: 1e-4 };

/** MediaPipe normalized landmarks → right-hand model space (meters, Y-up). */
export function landmarksToModelSpace(
  landmarks: HandLandmarks,
  scale = 1.35,
): HandLandmark[] {
  const wrist = landmarks[0]!;
  const out: HandLandmark[] = [];
  for (const lm of landmarks) {
    out.push({
      x: (lm.x - wrist.x) * scale,
      y: -(lm.y - wrist.y) * scale,
      z: -(lm.z - wrist.z) * scale,
    });
  }
  return out;
}

export function segmentDirection(
  landmarks: HandLandmark[],
  startIdx: number,
  endIdx: number,
): [number, number, number] | null {
  const a = landmarks[startIdx];
  const b = landmarks[endIdx];
  if (!a || !b) return null;
  let x = b.x - a.x;
  let y = b.y - a.y;
  let z = b.z - a.z;
  const len = Math.hypot(x, y, z);
  if (len < _tmp.minLen) return null;
  x /= len;
  y /= len;
  z /= len;
  return [x, y, z];
}

export function directionToQuaternion(
  from: [number, number, number],
  to: [number, number, number],
): [number, number, number, number] {
  const [fx, fy, fz] = from;
  const [tx, ty, tz] = to;
  const dot = fx * tx + fy * ty + fz * tz;
  if (dot > 0.999999) return [0, 0, 0, 1];
  if (dot < -0.999999) {
    let ax = 1;
    let ay = 0;
    let az = 0;
    if (Math.abs(fx) > 0.9) {
      ax = 0;
      ay = 1;
      az = 0;
    }
    const cx = fy * az - fz * ay;
    const cy = fz * ax - fx * az;
    const cz = fx * ay - fy * ax;
    const cl = Math.hypot(cx, cy, cz) || 1;
    return [cx / cl, cy / cl, cz / cl, 0];
  }
  const cx = fy * tz - fz * ty;
  const cy = fz * tx - fx * tz;
  const cz = fx * ty - fy * tx;
  const s = Math.sqrt((1 + dot) * 2);
  const invS = 1 / s;
  return [cx * invS, cy * invS, cz * invS, s * 0.5];
}

export function multiplyQuaternions(
  a: [number, number, number, number],
  b: [number, number, number, number],
): [number, number, number, number] {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function slerpQuaternion(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number,
): [number, number, number, number] {
  let [ax, ay, az, aw] = a;
  let [bx, by, bz, bw] = b;
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }
  if (dot > 0.9995) {
    return [
      ax + t * (bx - ax),
      ay + t * (by - ay),
      az + t * (bz - az),
      aw + t * (bw - aw),
    ];
  }
  const theta = Math.acos(Math.min(1, dot));
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return [
    ax * wa + bx * wb,
    ay * wa + by * wb,
    az * wa + bz * wb,
    aw * wa + bw * wb,
  ];
}

export function normalizeQuaternion(q: [number, number, number, number]): [number, number, number, number] {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}
