"use client";

import { Canvas, extend, type Catalogue } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { isDebugEnabled } from "@/lib/debug";
import { isTryOnMode } from "@/lib/modes";
import { PEDESTALS } from "@/lib/explore/layout";
import { quietThreeConsole } from "@/lib/quietConsole";
import { getProduct, type ProductRenderer } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";
import { lazy, Suspense, useState, type ComponentType } from "react";
import CartParticles from "./CartParticles";
import CameraRig from "./CameraRig";
import FrameStats from "./FrameStats";
import IdlePrefetch from "./IdlePrefetch";
import FacePaint from "./FacePaint";
import Glasses from "./Glasses";
import HairDye from "./HairDye";
import Headwear from "./Headwear";
import Lipstick from "./Lipstick";
import Ring from "./Ring";
import Watch from "./Watch";
import Wig from "./Wig";
import InteractPrompt from "./InteractPrompt";
import Player from "./Player";
import Showroom from "./Showroom";
import Lighting from "./Lighting";
import PostFx from "./PostFx";
import SceneBackground from "./SceneBackground";
import SceneReadyMarker from "./SceneReadyMarker";
import { loadSurfaceLayer } from "./IdlePrefetch";
import ThumbnailRenderer from "./ThumbnailRenderer";

// Register three/webgpu classes (node materials etc.) with the R3F reconciler.
extend(THREE as unknown as Catalogue);
quietThreeConsole();

// Surface (face mesh) layer: its own chunk (topology data), fetched on the first try-on or prefetched in CUSTOMIZE.
const SurfaceLayer = lazy(loadSurfaceLayer);

/** Mounted from the first try-on on and kept mounted, so its materials compile once. */
function LazySurfaceLayer() {
  const tryOn = useAppStore((s) => isTryOnMode(s.mode));
  const [mounted, setMounted] = useState(false);
  if (tryOn && !mounted) setMounted(true);
  return mounted ? (
    <Suspense fallback={null}>
      <SurfaceLayer />
    </Suspense>
  ) : null;
}

/** Scene component per product renderer (see `Product.renderer` in the registry). */
const RENDERERS: Record<ProductRenderer, ComponentType<{ productId: string }>> = {
  glasses: Glasses,
  lipstick: Lipstick,
  facePaint: FacePaint,
  watch: Watch,
  ring: Ring,
  hairDye: HairDye,
  headwear: Headwear,
  wig: Wig,
};

export default function Scene() {
  const setBackend = useAppStore((s) => s.setBackend);

  return (
    <Canvas
      camera={{ position: [0, 0.4, 4.5], fov: 50, near: 0.01, far: 30 }}
      // Pixel ratio clamped to [1, 2]: 3x phone screens would otherwise render 2.25x the pixels for little gain.
      dpr={[1, 2]}
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
        {PEDESTALS.map((p) => {
          const Renderer = RENDERERS[getProduct(p.productId)!.renderer];
          return <Renderer key={p.productId} productId={p.productId} />;
        })}
        <ThumbnailRenderer />
        <SceneReadyMarker />
      </Suspense>
      <Player />
      <InteractPrompt />
      <CartParticles />
      <CameraRig />
      <LazySurfaceLayer />
      <PostFx />
      <FrameStats />
      <IdlePrefetch />
    </Canvas>
  );
}
