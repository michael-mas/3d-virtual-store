"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/hooks/useT";
import { useAppStore } from "@/store/useAppStore";

/** Below this average FPS for LOW_FPS_WINDOWS consecutive 1 s windows, warn that the device is too slow. */
const LOW_FPS = 20;
const LOW_FPS_WINDOWS = 4;
const DISMISS_KEY = "perf-warning-dismissed";
const AUTO_HIDE_MS = 8000;

/** Fatal renderer problem: replaces a blank canvas with an explanation and a reload button. */
function RendererError() {
  const message = useAppStore((s) => s.rendererError);
  const t = useT();
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-noir p-6 text-ivory">
      <div role="alert" className="max-w-md space-y-4 text-center">
        <p className="wordmark text-sm text-gold">Maison Miroir</p>
        <h1 className="font-display text-2xl">{t("3D view unavailable")}</h1>
        <p className="text-sm text-taupe">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-gold rounded-sm px-5 py-2.5"
        >
          {t("Reload")}
        </button>
      </div>
    </div>
  );
}

/** Warns (dismissibly) when the frame rate stays below 20 FPS for a few seconds. */
function PerformanceWarning() {
  const stats = useAppStore((s) => s.frameStats);
  const lowStreak = useRef(0);
  const dismissedRef = useRef(false);
  const [show, setShow] = useState(false);
  const [lastFps, setLastFps] = useState<number | null>(null);
  const t = useT();

  useEffect(() => {
    if (!stats || document.visibilityState !== "visible") return;
    lowStreak.current = stats.fps < LOW_FPS ? lowStreak.current + 1 : 0;
    if (lowStreak.current < LOW_FPS_WINDOWS || dismissedRef.current) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Storage unavailable (private mode / blocked): just show the warning.
    }
    // Deferred so the state update is not synchronous within the effect; re-checks a dismissal in between.
    const id = requestAnimationFrame(() => {
      if (dismissedRef.current) return;
      setLastFps(stats.fps);
      setShow(true);
    });
    return () => cancelAnimationFrame(id);
  }, [stats]);

  // It says what it has to say, then gets out of the way (it would otherwise sit over the face in try-on).
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      dismissedRef.current = true;
      setShow(false);
    }, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;
  const dismiss = () => {
    dismissedRef.current = true;
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
      className="fixed top-32 left-1/2 z-50 flex w-[min(92vw,28rem)] sm:top-20 -translate-x-1/2 items-start gap-3 panel rounded-sm px-3 py-2 text-xs sm:p-3 sm:text-sm"
    >
      <p className="flex-1">
        {t("Low frame rate ({fps} fps): the experience may feel choppy.", { fps: lastFps?.toFixed(0) ?? "" })}
        <span className="hidden sm:inline"> {t("Try closing other tabs or apps.")}</span>
      </p>
      <button type="button" onClick={dismiss} className="text-gold-light underline underline-offset-4" aria-label={t("Dismiss performance warning")}>
        {t("Dismiss")}
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
