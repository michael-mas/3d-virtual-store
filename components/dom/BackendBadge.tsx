"use client";

import { useAppStore } from "@/store/useAppStore";

export default function BackendBadge() {
  const backend = useAppStore((s) => s.backend);

  return (
    <div
      className={`pointer-events-none fixed bottom-3 left-3 z-50 rounded px-2 py-1 font-mono text-xs text-white ${
        backend === "WebGPU" ? "bg-emerald-600" : backend === "WebGL2" ? "bg-amber-600" : "bg-neutral-600"
      }`}
    >
      {backend ?? "initializing…"}
    </div>
  );
}
