"use client";

import { Canvas, extend, type Catalogue } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { useAppStore } from "@/store/useAppStore";
import TestMesh from "./TestMesh";

// Register three/webgpu classes (node materials etc.) with the R3F reconciler.
extend(THREE as unknown as Catalogue);

export default function Scene() {
  const setBackend = useAppStore((s) => s.setBackend);

  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 45 }}
      // R3F defaults to PCFSoftShadowMap, which WebGPURenderer no longer supports.
      shadows={{ enabled: false, type: THREE.PCFShadowMap }}
      gl={async (defaults) => {
        const renderer = new THREE.WebGPURenderer({
          canvas: defaults.canvas as HTMLCanvasElement,
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
        // Falls back to the WebGL2 backend internally if WebGPU is unavailable.
        await renderer.init();
        const isWebGPU = "isWebGPUBackend" in renderer.backend;
        setBackend(isWebGPU ? "WebGPU" : "WebGL2");
        return renderer;
      }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <TestMesh />
    </Canvas>
  );
}
