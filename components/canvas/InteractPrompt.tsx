"use client";

import { Html } from "@react-three/drei";
import { useEffect } from "react";
import { productPosition } from "@/lib/explore/layout";
import { getProduct } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

/** "Press E / Click" prompt above the pedestal the player is near (EXPLORE only). */
export default function InteractPrompt() {
  const near = useAppStore((s) => (s.mode === "EXPLORE" ? s.nearPedestal : null));
  const interactWith = useAppStore((s) => s.interactWith);

  useEffect(() => {
    if (!near) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (!typing && !e.repeat && e.key.toLowerCase() === "e") interactWith(near);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [near, interactWith]);

  if (!near) return null;
  const [x, y, z] = productPosition(near);
  return (
    <Html position={[x, y + 0.14, z]} center zIndexRange={[40, 0]}>
      <button
        type="button"
        data-testid="interact-prompt"
        onClick={() => interactWith(near)}
        className="flex items-center gap-2 rounded-full bg-neutral-900/85 py-1.5 pr-3 pl-1.5 text-sm whitespace-nowrap text-white shadow-lg ring-1 ring-white/15 backdrop-blur hover:bg-neutral-800"
      >
        <kbd className="rounded-md bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-neutral-900">E</kbd>
        <span>
          Press E / Click · <span className="font-medium">{getProduct(near)?.name}</span>
        </span>
      </button>
    </Html>
  );
}
