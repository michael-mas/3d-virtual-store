"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

/** Errors within this window (ms), and how many of them, mean the frame loop is failing on every frame. */
const WINDOW_MS = 2000;
const REPEATED = 20;

/**
 * R3F schedules the next frame before running the current one, so code that throws on every frame does not crash
 * the page: it silently stops the rendering and the view freezes. This watches for errors repeating at frame rate
 * and replaces the frozen view with the renderer error screen, including the error itself (so it can be reported).
 */
export default function FrameErrorWatchdog() {
  useEffect(() => {
    let times: number[] = [];
    const onError = (e: ErrorEvent) => {
      const now = performance.now();
      times = times.filter((t) => now - t < WINDOW_MS);
      times.push(now);
      if (times.length >= REPEATED && !useAppStore.getState().rendererError) {
        const where = e.filename ? ` @ ${e.filename.split("/").pop()}:${e.lineno}:${e.colno}` : "";
        useAppStore.getState().setRendererError(`The 3D view stopped: ${e.message}${where}. Reload to continue.`);
      }
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);
  return null;
}
