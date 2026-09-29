"use client";

import type { ThreeEvent } from "@react-three/fiber";
import type { ReactNode } from "react";
import { PEDESTALS, productPosition } from "@/lib/explore/layout";
import { approachPoint } from "@/lib/explore/movement";
import { player, walkTo } from "@/lib/explore/player";
import { isTryOnMode } from "@/lib/modes";
import { useAppStore } from "@/store/useAppStore";

/** Scale used to keep objects drawn (bindings/pipelines kept current) while effectively invisible. */
export const TINY = 1e-4;

type Box = { size: [number, number, number]; center: [number, number, number] };

/**
 * A product displayed on its pedestal: placement, an invisible bounding-box hit target (walk there / interact),
 * and shrinking during try-on. Products stay mounted and drawn in try-on, shrunk to nothing rather than
 * `visible=false` (see the keep-alive note in Glasses.tsx).
 */
export default function PedestalMount({ productId, hitBox, children }: { productId: string; hitBox: Box; children: ReactNode }) {
  const mode = useAppStore((s) => s.mode);
  const interactWith = useAppStore((s) => s.interactWith);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (mode !== "EXPLORE") return;
    e.stopPropagation();
    // Near the pedestal: interact. Otherwise walk up to it.
    if (useAppStore.getState().nearPedestal === productId) interactWith(productId);
    else {
      const pedestal = PEDESTALS.find((p) => p.productId === productId);
      if (pedestal) walkTo(approachPoint(pedestal, player.position, 0.9));
    }
  };
  const setCursor = (cursor: string) => () => {
    document.body.style.cursor = mode === "EXPLORE" ? cursor : "auto";
  };

  return (
    <group position={productPosition(productId)} scale={isTryOnMode(mode) ? TINY : 1}>
      {children}
      <mesh
        visible={false}
        position={hitBox.center}
        onClick={onClick}
        onPointerOver={setCursor("pointer")}
        onPointerOut={setCursor("auto")}
      >
        <boxGeometry args={hitBox.size} />
      </mesh>
    </group>
  );
}
