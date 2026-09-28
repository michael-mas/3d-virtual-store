"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three/webgpu";
import { color, mix, normalWorld, oscSine } from "three/tsl";

export default function TestMesh() {
  const mesh = useRef<Mesh>(null);

  // TSL: blend two colors by world-space normal, animated over time.
  const colorNode = useMemo(() => {
    const t = normalWorld.y.mul(0.5).add(0.5).mul(oscSine());
    return mix(color("#4f46e5"), color("#f59e0b"), t);
  }, []);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.x += delta * 0.3;
    mesh.current.rotation.y += delta * 0.5;
  });

  return (
    <mesh ref={mesh}>
      <torusKnotGeometry args={[0.8, 0.28, 200, 32]} />
      <meshPhysicalNodeMaterial colorNode={colorNode} roughness={0.25} clearcoat={1} />
    </mesh>
  );
}
