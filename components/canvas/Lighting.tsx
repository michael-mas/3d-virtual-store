"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { PMREMGenerator, type WebGPURenderer } from "three/webgpu";

/** Local, procedural environment map (no HDR download) + a key light. */
export default function Lighting() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.8;
    room.dispose();
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  // Warm key light, like the salon's 2700 K downlights.
  return <directionalLight position={[0.6, 1.2, 0.8]} intensity={1.6} color="#ffe6c7" />;
}
