"use client";

import { Canvas, extend, type Catalogue } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { isDebugEnabled } from "@/lib/debug";
import { useAppStore } from "@/store/useAppStore";
import { Suspense } from "react";
import Backdrop from "./Backdrop";
import CartParticles from "./CartParticles";
import CameraRig from "./CameraRig";
import FrameStats from "./FrameStats";
import Glasses from "./Glasses";
import Lighting from "./Lighting";
import PostFx from "./PostFx";
import SceneBackground from "./SceneBackground";
import ThumbnailRenderer from "./ThumbnailRenderer";

// Register three/webgpu classes (node materials etc.) with the R3F reconciler.
extend(THREE as unknown as Catalogue);

export default function Scene() {
  const setBackend = useAppStore((s) => s.setBackend);

  return (
    <Canvas
      camera={{ position: [0.34, 0.16, 0.62], fov: 40, near: 0.01, far: 20 }}
      // R3F defaults to PCFSoftShadowMap, which WebGPURenderer no longer supports.
      shadows={{ enabled: false, type: THREE.PCFShadowMap }}
      gl={async (defaults) => {
        const renderer = new THREE.WebGPURenderer({
          canvas: defaults.canvas as HTMLCanvasElement,
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          // GPU timings for the dev panel only.
          trackTimestamp: isDebugEnabled(),
        });
        // Falls back to the WebGL2 backend internally if WebGPU is unavailable.
        await renderer.init();
        const isWebGPU = "isWebGPUBackend" in renderer.backend;
        setBackend(isWebGPU ? "WebGPU" : "WebGL2");
        return renderer;
      }}
    >
      <SceneBackground />
      <Lighting />
      <Backdrop />
      <Suspense fallback={null}>
        <Glasses />
        <ThumbnailRenderer />
      </Suspense>
      <CartParticles />
      <CameraRig />
      <PostFx />
      <FrameStats />
    </Canvas>
  );
}
