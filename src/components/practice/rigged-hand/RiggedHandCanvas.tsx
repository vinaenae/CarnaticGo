"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { RiggedHandMesh } from "@/components/practice/rigged-hand/RiggedHandMesh";
import type { HandLandmarks } from "@/lib/hand-rig/landmarks";
import styles from "@/components/practice/TalaHand3D.module.css";

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.58} />
      <hemisphereLight args={["#fff8f0", "#3d2818", 0.48]} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.2} castShadow />
      <directionalLight position={[-2, 1.5, 2]} intensity={0.38} color="#ffd8c0" />
      <pointLight position={[0, 0.5, 1.2]} intensity={0.28} color="#fff5ee" />
    </>
  );
}

export function RiggedHandCanvas({
  landmarks,
  gestureRotation,
  pulse,
}: {
  landmarks: HandLandmarks | null;
  gestureRotation?: [number, number, number];
  pulse: number;
}) {
  return (
    <div className={styles.canvasWrap}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.06, 0.42], fov: 36, near: 0.01, far: 8 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["transparent"]} />
        <SceneLights />
        <Environment preset="studio" environmentIntensity={0.55} />
        <RiggedHandMesh
          landmarks={landmarks}
          gestureRotation={gestureRotation}
          pulse={pulse}
        />
        <ContactShadows
          position={[0, -0.11, 0]}
          opacity={0.55}
          scale={0.35}
          blur={2.2}
          far={0.4}
        />
      </Canvas>
    </div>
  );
}
