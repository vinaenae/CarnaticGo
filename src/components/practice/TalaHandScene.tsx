"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, RoundedBox } from "@react-three/drei";
import type { Group } from "three";
import type { TalaGesture } from "@/lib/carnatic-tala";
import styles from "@/components/practice/TalaHand3D.module.css";

const SKIN = "#e8c4a8";
const SKIN_SHADOW = "#a67a5c";

function SkinMaterial() {
  return (
    <meshPhysicalMaterial
      color={SKIN}
      roughness={0.42}
      metalness={0.02}
      clearcoat={0.18}
      clearcoatRoughness={0.32}
      sheen={0.48}
      sheenRoughness={0.5}
      sheenColor="#fff0e6"
      envMapIntensity={0.9}
    />
  );
}

function NailMaterial() {
  return (
    <meshPhysicalMaterial
      color="#f2ddd0"
      roughness={0.28}
      metalness={0}
      transmission={0.1}
      thickness={0.06}
      clearcoat={0.4}
    />
  );
}

/** Capsule phalanx; slightly overlaps neighbors when stacked. */
function Phalanx({
  radius,
  length,
  y,
}: {
  radius: number;
  length: number;
  y: number;
}) {
  return (
    <mesh position={[0, y + length * 0.5 + radius, 0]} castShadow receiveShadow>
      <capsuleGeometry args={[radius, Math.max(0.001, length), 12, 24]} />
      <SkinMaterial />
    </mesh>
  );
}

/** Rounded joint so segments read as one continuous finger, not separate bones. */
function Knuckle({ radius, y, z = 0 }: { radius: number; y: number; z?: number }) {
  return (
    <mesh position={[0, y, z]} castShadow receiveShadow>
      <sphereGeometry args={[radius * 1.12, 20, 18]} />
      <SkinMaterial />
    </mesh>
  );
}

function Finger({
  lengths,
  radii,
  x,
  z = 0,
  spreadZ = 0,
  raised,
  metacarpalLength = 0.014,
}: {
  lengths: [number, number, number];
  radii: [number, number, number];
  x: number;
  z?: number;
  spreadZ?: number;
  raised: boolean;
  metacarpalLength?: number;
}) {
  const group = useRef<Group>(null);
  const lift = raised ? -1.05 : 0;

  useEffect(() => {
    if (!group.current) return;
    group.current.rotation.x = lift;
  }, [lift]);

  const overlap = 1.35;
  let y = 0;
  const parts: { length: number; radius: number; y: number }[] = [];

  const metaR = radii[0]! * 1.2;
  const metaY = -metacarpalLength * 0.15;

  for (let i = 0; i < 3; i++) {
    parts.push({ length: lengths[i]!, radius: radii[i]!, y });
    y += lengths[i]! + radii[i]! * overlap;
  }

  const nailY = y + radii[2]! * 0.2;

  return (
    <group ref={group} position={[x, 0.02, z]} rotation={[0, spreadZ, 0]}>
      <Phalanx radius={metaR} length={metacarpalLength} y={metaY} />
      <Knuckle radius={metaR} y={metacarpalLength * 0.5 + metaR * 0.5} />
      {parts.map((p, i) => (
        <group key={i}>
          <Phalanx radius={p.radius} length={p.length} y={p.y} />
          {i < parts.length - 1 ? (
            <Knuckle
              radius={(p.radius + parts[i + 1]!.radius) * 0.5}
              y={p.y + p.length + p.radius * overlap * 0.5}
            />
          ) : null}
        </group>
      ))}
      <Knuckle radius={radii[2]!} y={nailY - radii[2]! * 1.1} />
      <mesh position={[0, nailY, radii[2]! * 0.28]} castShadow>
        <boxGeometry args={[radii[2]! * 1.5, radii[2]! * 0.85, radii[2]! * 0.42]} />
        <NailMaterial />
      </mesh>
    </group>
  );
}

function Thumb({ raised }: { raised: boolean }) {
  const group = useRef<Group>(null);
  const lift = raised ? -0.95 : 0;
  const r0 = 0.012;
  const r1 = 0.011;
  const l0 = 0.03;
  const l1 = 0.026;

  useEffect(() => {
    if (!group.current) return;
    group.current.rotation.x = lift;
  }, [lift]);

  const y1 = l0 + r0 * 1.35;

  return (
    <group
      ref={group}
      position={[-0.064, 0.012, 0.024]}
      rotation={[0.12, 0.52, -0.74]}
    >
      <Phalanx radius={r0 * 1.15} length={0.012} y={-0.006} />
      <Knuckle radius={r0 * 1.2} y={0.008} z={0.004} />
      <Phalanx radius={r0} length={l0} y={0} />
      <Knuckle radius={(r0 + r1) * 0.55} y={y1 * 0.55} />
      <Phalanx radius={r1} length={l1} y={y1 - r1 * 0.2} />
      <Knuckle radius={r1} y={y1 + l1 + r1 * 0.5} />
      <mesh position={[0, y1 + l1 + r1 * 1.1, 0.014]} castShadow>
        <boxGeometry args={[0.017, 0.01, 0.008]} />
        <NailMaterial />
      </mesh>
    </group>
  );
}

function Palm() {
  return (
    <group position={[0, 0.008, 0]}>
      <mesh castShadow receiveShadow scale={[1.05, 0.92, 0.88]}>
        <sphereGeometry args={[0.052, 32, 24]} />
        <SkinMaterial />
      </mesh>
      <RoundedBox
        args={[0.098, 0.068, 0.036]}
        radius={0.016}
        smoothness={8}
        castShadow
        receiveShadow
        position={[0, 0.012, 0.002]}
      >
        <SkinMaterial />
      </RoundedBox>
      <mesh position={[0, 0.052, 0.01]} castShadow receiveShadow>
        <sphereGeometry args={[0.042, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <SkinMaterial />
      </mesh>
      {[-0.026, -0.008, 0.01, 0.03].map((px, i) => (
        <mesh key={i} position={[px, 0.044, 0.012]} castShadow>
          <sphereGeometry args={[0.009, 14, 12]} />
          <meshPhysicalMaterial color={SKIN_SHADOW} roughness={0.5} sheen={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/** Skin between finger bases (palm webbing). */
function FingerWebbing() {
  const webs: [number, number, number][] = [
    [-0.018, 0.038, 0.01],
    [0.002, 0.04, 0.012],
    [0.022, 0.038, 0.01],
  ];
  return (
    <>
      {webs.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.35, 0, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.007, 0.014, 8, 12]} />
          <SkinMaterial />
        </mesh>
      ))}
    </>
  );
}

function HandModel({
  gesture,
  raisedFinger,
  pulse,
}: {
  gesture: TalaGesture;
  raisedFinger: number | null;
  pulse: number;
}) {
  const root = useRef<Group>(null);
  const scale = useRef(1);

  const baseRotation = useMemo((): [number, number, number] => {
    if (gesture === "wave") return [0.22, 2.55, 0.02];
    if (gesture === "count") return [0.28, -0.48, -0.02];
    return [0.26, -0.52, -0.01];
  }, [gesture]);

  useEffect(() => {
    scale.current = 1.045;
  }, [pulse]);

  useFrame((_, dt) => {
    if (!root.current) return;
    scale.current += (1 - scale.current) * Math.min(1, dt * 14);
    root.current.scale.setScalar(scale.current);
    root.current.rotation.set(baseRotation[0], baseRotation[1], baseRotation[2]);
  });

  return (
    <group ref={root} position={[0, -0.04, 0]}>
      <RoundedBox
        args={[0.046, 0.04, 0.036]}
        radius={0.012}
        smoothness={6}
        position={[0, -0.028, -0.004]}
        castShadow
        receiveShadow
      >
        <SkinMaterial />
      </RoundedBox>
      <mesh position={[0, -0.018, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.028, 20, 16]} />
        <SkinMaterial />
      </mesh>
      <Palm />
      <FingerWebbing />
      <Thumb raised={raisedFinger === 0} />
      <Finger
        x={-0.03}
        spreadZ={-0.06}
        lengths={[0.026, 0.022, 0.018]}
        radii={[0.0088, 0.008, 0.0072]}
        raised={raisedFinger === 1}
      />
      <Finger
        x={-0.01}
        lengths={[0.03, 0.026, 0.02]}
        radii={[0.0092, 0.0084, 0.0076]}
        raised={raisedFinger === 2}
      />
      <Finger
        x={0.012}
        spreadZ={0.04}
        lengths={[0.028, 0.024, 0.019]}
        radii={[0.0088, 0.008, 0.0072]}
        raised={raisedFinger === 3}
      />
      <Finger
        x={0.034}
        spreadZ={0.1}
        lengths={[0.022, 0.018, 0.014]}
        radii={[0.0072, 0.0066, 0.0058]}
        raised={raisedFinger === 4}
        metacarpalLength={0.012}
      />
    </group>
  );
}

function Lights() {
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

export default function TalaHandScene({
  gesture,
  raisedFinger,
  pulse,
}: {
  gesture: TalaGesture;
  raisedFinger: number | null;
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
        <Lights />
        <Environment preset="studio" environmentIntensity={0.55} />
        <HandModel gesture={gesture} raisedFinger={raisedFinger} pulse={pulse} />
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
