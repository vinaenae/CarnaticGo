/** MediaPipe Hand Landmarker indices (21 points). */
export const MP_WRIST = 0;
export const MP_THUMB_CMC = 1;
export const MP_THUMB_MCP = 2;
export const MP_THUMB_IP = 3;
export const MP_THUMB_TIP = 4;
export const MP_INDEX_MCP = 5;
export const MP_INDEX_PIP = 6;
export const MP_INDEX_DIP = 7;
export const MP_INDEX_TIP = 8;
export const MP_MIDDLE_MCP = 9;
export const MP_MIDDLE_PIP = 10;
export const MP_MIDDLE_DIP = 11;
export const MP_MIDDLE_TIP = 12;
export const MP_RING_MCP = 13;
export const MP_RING_PIP = 14;
export const MP_RING_DIP = 15;
export const MP_RING_TIP = 16;
export const MP_PINKY_MCP = 17;
export const MP_PINKY_PIP = 18;
export const MP_PINKY_DIP = 19;
export const MP_PINKY_TIP = 20;

export type HandLandmark = {
  x: number;
  y: number;
  z: number;
};

export type HandLandmarks = readonly HandLandmark[];

/** OpenXR / WebXR hand bone names in the rigged GLB. */
export type HandBoneName =
  | "wrist"
  | "thumb-metacarpal"
  | "thumb-phalanx-proximal"
  | "thumb-phalanx-distal"
  | "thumb-tip"
  | "index-finger-metacarpal"
  | "index-finger-phalanx-proximal"
  | "index-finger-phalanx-intermediate"
  | "index-finger-phalanx-distal"
  | "index-finger-tip"
  | "middle-finger-metacarpal"
  | "middle-finger-phalanx-proximal"
  | "middle-finger-phalanx-intermediate"
  | "middle-finger-phalanx-distal"
  | "middle-finger-tip"
  | "ring-finger-metacarpal"
  | "ring-finger-phalanx-proximal"
  | "ring-finger-phalanx-intermediate"
  | "ring-finger-phalanx-distal"
  | "ring-finger-tip"
  | "pinky-finger-metacarpal"
  | "pinky-finger-phalanx-proximal"
  | "pinky-finger-phalanx-intermediate"
  | "pinky-finger-phalanx-distal"
  | "pinky-finger-tip";

/** Landmark segment used to aim each bone (parent joint → child joint). */
export const HAND_BONE_LANDMARK_SEGMENTS: Readonly<
  Record<HandBoneName, readonly [number, number]>
> = {
  wrist: [MP_WRIST, MP_MIDDLE_MCP],
  "thumb-metacarpal": [MP_THUMB_CMC, MP_THUMB_MCP],
  "thumb-phalanx-proximal": [MP_THUMB_MCP, MP_THUMB_IP],
  "thumb-phalanx-distal": [MP_THUMB_IP, MP_THUMB_TIP],
  "thumb-tip": [MP_THUMB_IP, MP_THUMB_TIP],
  "index-finger-metacarpal": [MP_WRIST, MP_INDEX_MCP],
  "index-finger-phalanx-proximal": [MP_INDEX_MCP, MP_INDEX_PIP],
  "index-finger-phalanx-intermediate": [MP_INDEX_PIP, MP_INDEX_DIP],
  "index-finger-phalanx-distal": [MP_INDEX_DIP, MP_INDEX_TIP],
  "index-finger-tip": [MP_INDEX_DIP, MP_INDEX_TIP],
  "middle-finger-metacarpal": [MP_WRIST, MP_MIDDLE_MCP],
  "middle-finger-phalanx-proximal": [MP_MIDDLE_MCP, MP_MIDDLE_PIP],
  "middle-finger-phalanx-intermediate": [MP_MIDDLE_PIP, MP_MIDDLE_DIP],
  "middle-finger-phalanx-distal": [MP_MIDDLE_DIP, MP_MIDDLE_TIP],
  "middle-finger-tip": [MP_MIDDLE_DIP, MP_MIDDLE_TIP],
  "ring-finger-metacarpal": [MP_WRIST, MP_RING_MCP],
  "ring-finger-phalanx-proximal": [MP_RING_MCP, MP_RING_PIP],
  "ring-finger-phalanx-intermediate": [MP_RING_PIP, MP_RING_DIP],
  "ring-finger-phalanx-distal": [MP_RING_DIP, MP_RING_TIP],
  "ring-finger-tip": [MP_RING_DIP, MP_RING_TIP],
  "pinky-finger-metacarpal": [MP_WRIST, MP_PINKY_MCP],
  "pinky-finger-phalanx-proximal": [MP_PINKY_MCP, MP_PINKY_PIP],
  "pinky-finger-phalanx-intermediate": [MP_PINKY_PIP, MP_PINKY_DIP],
  "pinky-finger-phalanx-distal": [MP_PINKY_DIP, MP_PINKY_TIP],
  "pinky-finger-tip": [MP_PINKY_DIP, MP_PINKY_TIP],
};

export const HAND_BONE_NAMES = Object.keys(
  HAND_BONE_LANDMARK_SEGMENTS,
) as HandBoneName[];

export const HAND_MODEL_URL = "/models/hand/rigged-hand.glb";
