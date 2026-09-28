"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

/** Below this average FPS for LOW_FPS_WINDOWS consecutive 1 s windows, warn that the device is too slow. */
const LOW_FPS = 20;
const LOW_FPS_WINDOWS = 4;
const DISMISS_KEY = "perf-warning-dismissed";

/** Fatal renderer problem: replaces a blank canvas with an explanation and a reload button. */
function RendererError() {
  const message = useAppStore((s) => s.rendererError);
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <div role="alert" className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">3D view unavailable</h1>
        <p className="text-sm text-neutral-300">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/** Warns (dismissibly) when the frame rate stays below 20 FPS for a few seconds. */
function PerformanceWarning() {
  const stats = useAppStore((s) => s.frameStats);
  const lowStreak = useRef(0);
  const [show, setShow] = useState(false);
  const [lastFps, setLastFps] = useState<number | null>(null);

  useEffect(() => {
    if (!stats || document.visibilityState !== "visible") return;
    lowStreak.current = stats.fps < LOW_FPS ? lowStreak.current + 1 : 0;
    if (lowStreak.current < LOW_FPS_WINDOWS) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // Storage unavailable (private mode / blocked): just show the warning.
    }
    if (dismissed) return;
    // Deferred so the state update is not synchronous within the effect.
    const id = requestAnimationFrame(() => {
      setLastFps(stats.fps);
      setShow(true);
    });
    return () => cancelAnimationFrame(id);
  }, [stats]);

  if (!show) return null;
  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage unavailable: dismissal lasts until reload.
    }
    setShow(false);
  };
  return (
    <div
      role="status"
      data-testid="perf-warning"
      className="fixed top-16 left-1/2 z-50 flex w-[min(92vw,28rem)] -translate-x-1/2 items-start gap-3 rounded-xl bg-amber-500/95 p-3 text-sm text-neutral-950 shadow-lg"
    >
      <p className="flex-1">
        This device is struggling ({lastFps?.toFixed(0)} fps). Try closing other tabs or apps; the experience may feel
        choppy.
      </p>
      <button type="button" onClick={dismiss} className="font-medium underline" aria-label="Dismiss performance warning">
        Dismiss
      </button>
    </div>
  );
}

export default function StatusOverlays() {
  return (
    <>
      <RendererError />
      <PerformanceWarning />
    </>
  );
}
