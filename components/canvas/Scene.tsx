"use client";

import { Canvas, extend, type Catalogue } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { isDebugEnabled } from "@/lib/debug";
import { PEDESTALS } from "@/lib/explore/layout";
import { useAppStore } from "@/store/useAppStore";
import { Suspense } from "react";
import CartParticles from "./CartParticles";
import CameraRig from "./CameraRig";
import FrameStats from "./FrameStats";
import Glasses from "./Glasses";
import InteractPrompt from "./InteractPrompt";
import Player from "./Player";
import Showroom from "./Showroom";
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
      camera={{ position: [0, 0.4, 4.5], fov: 50, near: 0.01, far: 30 }}
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
        // Falls back to the WebGL2 backend internally if WebGPU is unavailable. If both fail, init() throws
        // and RendererErrorBoundary shows an explanation.
        await renderer.init();
        // GPU reset / driver crash: explain instead of leaving a frozen canvas.
        renderer.onDeviceLost = (info) => {
          console.error("[renderer] device lost", info);
          useAppStore.getState().setRendererError("The graphics device was lost (GPU reset or driver crash). Reload to continue.");
        };
        const isWebGPU = "isWebGPUBackend" in renderer.backend;
        setBackend(isWebGPU ? "WebGPU" : "WebGL2");
        return renderer;
      }}
    >
      <SceneBackground />
      <Lighting />
      <Suspense fallback={null}>
        <Showroom />
        {PEDESTALS.map((p) => (
          <Glasses key={p.productId} productId={p.productId} />
        ))}
        <ThumbnailRenderer />
      </Suspense>
      <Player />
      <InteractPrompt />
      <CartParticles />
      <CameraRig />
      <PostFx />
      <FrameStats />
    </Canvas>
  );
}
