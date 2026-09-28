"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * Mounted inside the scene's Suspense boundary, so it only runs once the showroom and products have loaded.
 * Priority 2 runs after PostFx renders (priority 1): the first call happens right after the first frame that
 * actually shows the scene. Records the "first-frame" performance mark and lifts the loading screen.
 */
export default function SceneReadyMarker() {
  const done = useRef(false);
  // Mounted = all suspended assets are loaded (before the first render with them).
  useEffect(() => {
    performance.mark("scene-loaded");
  }, []);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    performance.mark("first-frame");
    useAppStore.getState().setSceneReady();
  }, 2);
  return null;
}
