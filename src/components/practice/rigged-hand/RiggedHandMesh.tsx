"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  HAND_BONE_NAMES,
  HAND_MODEL_URL,
  type HandBoneName,
  type HandLandmarks,
} from "@/lib/hand-rig/landmarks";
import { landmarksToModelSpace } from "@/lib/hand-rig/math";
import {
  BoneRotationSmoother,
  solveBoneRotationsFromLandmarks,
  type BoneBindPose,
} from "@/lib/hand-rig/rotation-solver";

useGLTF.preload(HAND_MODEL_URL);

const BONE_CHILD: Partial<Record<HandBoneName, HandBoneName>> = {
  wrist: "middle-finger-metacarpal",
  "thumb-metacarpal": "thumb-phalanx-proximal",
  "thumb-phalanx-proximal": "thumb-phalanx-distal",
  "thumb-phalanx-distal": "thumb-tip",
  "index-finger-metacarpal": "index-finger-phalanx-proximal",
  "index-finger-phalanx-proximal": "index-finger-phalanx-intermediate",
  "index-finger-phalanx-intermediate": "index-finger-phalanx-distal",
  "index-finger-phalanx-distal": "index-finger-tip",
  "middle-finger-metacarpal": "middle-finger-phalanx-proximal",
  "middle-finger-phalanx-proximal": "middle-finger-phalanx-intermediate",
  "middle-finger-phalanx-intermediate": "middle-finger-phalanx-distal",
  "middle-finger-phalanx-distal": "middle-finger-tip",
  "ring-finger-metacarpal": "ring-finger-phalanx-proximal",
  "ring-finger-phalanx-proximal": "ring-finger-phalanx-intermediate",
  "ring-finger-phalanx-intermediate": "ring-finger-phalanx-distal",
  "ring-finger-phalanx-distal": "ring-finger-tip",
  "pinky-finger-metacarpal": "pinky-finger-phalanx-proximal",
  "pinky-finger-phalanx-proximal": "pinky-finger-phalanx-intermediate",
  "pinky-finger-phalanx-intermediate": "pinky-finger-phalanx-distal",
  "pinky-finger-phalanx-distal": "pinky-finger-tip",
};

function captureBindPoses(root: THREE.Object3D): Map<HandBoneName, BoneBindPose> {
  const bones = new Map<string, THREE.Bone>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
  });

  const poses = new Map<HandBoneName, BoneBindPose>();
  root.updateMatrixWorld(true);

  for (const boneName of HAND_BONE_NAMES) {
    const bone = bones.get(boneName);
    if (!bone) continue;

    const bonePos = new THREE.Vector3();
    const childPos = new THREE.Vector3();
    bone.getWorldPosition(bonePos);

    const childName = BONE_CHILD[boneName];
    const childBone = childName ? bones.get(childName) : undefined;
    if (childBone) {
      childBone.getWorldPosition(childPos);
    } else {
      childPos.copy(bonePos).add(new THREE.Vector3(0, 0.025, 0));
    }

    const worldDir = childPos.sub(bonePos).normalize();
    const invQuat = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    const localDir = worldDir.clone().applyQuaternion(invQuat).normalize();

    poses.set(boneName, {
      localQuat: [
        bone.quaternion.x,
        bone.quaternion.y,
        bone.quaternion.z,
        bone.quaternion.w,
      ],
      aimDirection: [localDir.x, localDir.y, localDir.z],
    });
  }

  return poses;
}

function upgradeMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mat = mesh.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#e8c4a8"),
        roughness: 0.42,
        metalness: 0.04,
      });
    } else {
      mat.roughness = 0.42;
      mat.metalness = 0.04;
      mat.color.set("#e8c4a8");
    }
  });
}

export function RiggedHandMesh({
  landmarks,
  gestureRotation,
  pulse,
}: {
  landmarks: HandLandmarks | null;
  gestureRotation?: [number, number, number];
  pulse: number;
}) {
  const { scene } = useGLTF(HAND_MODEL_URL);
  const rootRef = useRef<THREE.Group>(null);
  const bonesRef = useRef<Map<string, THREE.Bone>>(new Map());
  const bindPosesRef = useRef<Map<HandBoneName, BoneBindPose>>(new Map());
  const smoother = useMemo(() => new BoneRotationSmoother(0.2), []);
  const scaleRef = useRef(1);

  useEffect(() => {
    scaleRef.current = 1.045;
  }, [pulse]);

  useEffect(() => {
    const clone = scene.clone(true);
    upgradeMaterials(clone);
    const bones = new Map<string, THREE.Bone>();
    clone.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
    });
    bonesRef.current = bones;
    bindPosesRef.current = captureBindPoses(clone);
    if (rootRef.current) {
      rootRef.current.clear();
      rootRef.current.add(clone);
    }
  }, [scene]);

  useFrame((_, dt) => {
    if (!landmarks || landmarks.length < 21) return;
    const modelSpace = landmarksToModelSpace(landmarks);
    const target = solveBoneRotationsFromLandmarks(
      modelSpace,
      bindPosesRef.current,
    );
    const smoothed = smoother.smooth(target);
    for (const [name, quat] of smoothed) {
      const bone = bonesRef.current.get(name);
      if (!bone) continue;
      bone.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
    }
    if (rootRef.current) {
      scaleRef.current += (1 - scaleRef.current) * Math.min(1, dt * 14);
      const s = 1.05 * scaleRef.current;
      rootRef.current.scale.setScalar(s);
      if (gestureRotation) {
        rootRef.current.rotation.set(
          gestureRotation[0],
          gestureRotation[1],
          gestureRotation[2],
        );
      }
    }
  });

  return (
    <group ref={rootRef} rotation={[-Math.PI / 2, 0, Math.PI]} position={[0, -0.04, 0]} />
  );
}
