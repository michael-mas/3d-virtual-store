"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * Initial loading screen: progress of the scene assets (GLBs via three's DefaultLoadingManager, through drei's
 * useProgress), until the first frame is rendered. Fades out, then unmounts.
 */
export default function LoadingScreen() {
  const { progress, active, item } = useProgress();
  const ready = useAppStore((s) => s.sceneReady || s.rendererError !== null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setGone(true), 500);
    return () => clearTimeout(t);
  }, [ready]);

  if (gone) return null;
  // Before any asset request starts, progress is 0 and inactive: show an indeterminate start.
  const pct = ready ? 100 : Math.round(progress);
  const label = ready ? "Ready" : active ? `Loading ${item.split("/").pop() ?? "assets"}…` : "Starting renderer…";

  return (
    <div
      role="progressbar"
      aria-label="Loading the store"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      data-testid="loading-screen"
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-noir text-ivory transition-opacity duration-700 ${
        ready ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <p className="wordmark text-2xl sm:text-3xl">Maison Miroir</p>
        <p className="eyebrow text-gold">Virtual boutique</p>
      </div>
      <div className="h-px w-56 overflow-hidden bg-ivory/15">
        <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <p className="eyebrow text-[0.6rem]">{label}</p>
    </div>
  );
}
