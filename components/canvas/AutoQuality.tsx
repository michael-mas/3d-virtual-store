"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

/** Below this average FPS for WINDOWS consecutive one-second windows, the quality steps down. */
const LOW_FPS = 32;
const WINDOWS = 5;

/**
 * Automatic quality for slower devices: when the frame rate stays low, first render at 1× pixel ratio (the largest
 * saving on high-density screens), then turn off the post-processing (bloom, floor reflection). Never back up during
 * a visit (no oscillation). Not during try-on, where tracking itself throttles to keep rendering smooth.
 */
export default function AutoQuality() {
  const setDpr = useThree((s) => s.setDpr);
  const dpr = useThree((s) => s.viewport.dpr);
  const low = useRef(0);
  const step = useRef(0);

  useEffect(
    () =>
      useAppStore.subscribe((s, prev) => {
        if (s.frameStats === prev.frameStats || !s.frameStats || !s.sceneReady || s.mode !== "EXPLORE") return;
        if (document.visibilityState !== "visible") return;
        low.current = s.frameStats.fps < LOW_FPS ? low.current + 1 : 0;
        if (low.current < WINDOWS) return;
        low.current = 0;
        if (step.current === 0 && dpr > 1) {
          step.current = 1;
          setDpr(1);
          console.info("[quality] pixel ratio 1×");
        } else if (step.current <= 1 && s.postFx) {
          step.current = 2;
          s.setPostFx(false);
          console.info("[quality] post-processing off");
        }
      }),
    [setDpr, dpr],
  );
  return null;
}
