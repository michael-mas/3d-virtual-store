"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import { DRACO_DECODER_PATH, HEAD_OCCLUDER_MODEL_PATH } from "@/lib/assets";
import { canPrefetchTryOn, loadTryOnAssets } from "@/lib/tryon/assets";
import { useAppStore } from "@/store/useAppStore";

/** The try-on surface layer chunk (face mesh topology); shared with Scene's lazy component. */
export const loadSurfaceLayer = () => import("./SurfaceLayer");

const whenIdle = (fn: () => void, delay: number) => {
  const t = window.setTimeout(() => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout: 5000 });
    else fn();
  }, delay);
  return () => window.clearTimeout(t);
};

/**
 * Preloads the next likely assets while the user is idle:
 * - EXPLORE: the head occluder GLB (needed by try-on, tiny);
 * - CUSTOMIZE: the surface layer chunk, and the try-on stack — MediaPipe JS, WASM and model (~16 MB) — unless
 *   Data Saver or a slow connection. Nothing is initialized here; entering TRY_ON reuses the same in-flight download.
 */
export default function IdlePrefetch() {
  const mode = useAppStore((s) => s.mode);
  const ready = useAppStore((s) => s.sceneReady);

  useEffect(() => {
    if (!ready) return;
    if (mode === "EXPLORE") return whenIdle(() => useGLTF.preload(HEAD_OCCLUDER_MODEL_PATH, DRACO_DECODER_PATH), 1500);
    if (mode === "CUSTOMIZE") {
      return whenIdle(() => {
        void loadSurfaceLayer();
        if (!canPrefetchTryOn()) return;
        useGLTF.preload(HEAD_OCCLUDER_MODEL_PATH, DRACO_DECODER_PATH);
        loadTryOnAssets().catch(() => {
          // A failed prefetch is retried (with error handling) when entering TRY_ON.
        });
      }, 2500);
    }
  }, [mode, ready]);

  return null;
}
