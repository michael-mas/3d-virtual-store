"use client";

import { Html } from "@react-three/drei";
import { useEffect } from "react";
import { productPosition } from "@/lib/explore/layout";
import { getProduct } from "@/lib/products";
import { useT } from "@/hooks/useT";
import { useAppStore } from "@/store/useAppStore";

/** "Press E / Click" prompt above the pedestal the player is near (EXPLORE only). */
export default function InteractPrompt() {
  const near = useAppStore((s) => (s.mode === "EXPLORE" ? s.nearPedestal : null));
  const interactWith = useAppStore((s) => s.interactWith);
  const t = useT();

  useEffect(() => {
    if (!near) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (!typing && !e.repeat && e.code === "KeyE") interactWith(near);
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
        className="flex items-center gap-2.5 rounded-full border border-gold/40 bg-noir/80 py-1.5 pr-4 pl-1.5 text-[0.7rem] tracking-[0.14em] whitespace-nowrap text-ivory uppercase shadow-lg backdrop-blur hover:border-gold"
      >
        <kbd className="flex size-6 items-center justify-center rounded-full bg-gold font-display text-xs text-noir pointer-coarse:hidden">
          E
        </kbd>
        <span>
          <span className="pointer-coarse:hidden">{t("Press E / Click")} · </span>
          <span className="hidden pointer-coarse:inline">{t("Tap to view")} · </span>
          <span className="font-display text-sm tracking-[0.08em] normal-case">{getProduct(near)?.name}</span>
        </span>
      </button>
    </Html>
  );
}
