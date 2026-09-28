"use client";

import { useSyncExternalStore } from "react";
import { isDebugEnabled } from "@/lib/debug";
import { useAppStore } from "@/store/useAppStore";

const subscribe = () => () => {};

/** Active renderer backend. Dev only (or `?debug` in production). */
export default function BackendBadge() {
  const visible = useSyncExternalStore(subscribe, isDebugEnabled, () => false);
  const backend = useAppStore((s) => s.backend);

  if (!visible) return null;

  return (
    <div
      className={`pointer-events-none fixed right-3 bottom-3 z-50 rounded px-2 py-1 font-mono text-xs text-white ${
        backend === "WebGPU" ? "bg-emerald-600" : backend === "WebGL2" ? "bg-amber-600" : "bg-neutral-600"
      }`}
    >
      {backend ?? "initializing…"}
    </div>
  );
}
