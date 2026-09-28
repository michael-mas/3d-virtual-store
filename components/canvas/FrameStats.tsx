"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { WebGPURenderer } from "three/webgpu";
import { isDebugEnabled } from "@/lib/debug";
import { useAppStore } from "@/store/useAppStore";

const WINDOW_MS = 1000;

/**
 * Samples frame intervals (and GPU render time when `trackTimestamp` is on) and publishes
 * avg FPS / worst frame / avg GPU ms to the store once per second.
 */
export default function FrameStats() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const acc = useRef({ frames: 0, elapsed: 0, worst: 0, gpu: 0, gpuSamples: 0 });
  const resolving = useRef(false);
  // Matches `trackTimestamp` passed to the renderer in Scene.tsx.
  const trackGpu = useMemo(() => isDebugEnabled(), []);

  useFrame((_, delta) => {
    const ms = delta * 1000;
    const a = acc.current;
    a.frames++;
    a.elapsed += ms;
    a.worst = Math.max(a.worst, ms);

    if (trackGpu && !resolving.current) {
      resolving.current = true;
      gl.resolveTimestampsAsync()
        .then((d) => {
          if (typeof d === "number" && d > 0) {
            acc.current.gpu += d;
            acc.current.gpuSamples++;
          }
        })
        .finally(() => (resolving.current = false));
    }

    if (a.elapsed >= WINDOW_MS) {
      useAppStore.getState().setFrameStats({
        fps: (a.frames * 1000) / a.elapsed,
        worstMs: a.worst,
        gpuMs: a.gpuSamples > 0 ? a.gpu / a.gpuSamples : null,
        programs: gl.info.memory.programs,
      });
      acc.current = { frames: 0, elapsed: 0, worst: 0, gpu: 0, gpuSamples: 0 };
    }
  });

  return null;
}
