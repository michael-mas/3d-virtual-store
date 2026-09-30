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
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-200 transition-opacity duration-500 ${
        ready ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <p className="text-lg font-semibold tracking-tight">3D Virtual Store</p>
      <div className="h-1 w-56 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-300" style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <p className="text-xs text-neutral-400">{label}</p>
    </div>
  );
}
