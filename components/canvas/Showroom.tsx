"use client";

import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import { Mesh, MeshBasicNodeMaterial } from "three/webgpu";
import { DRACO_DECODER_PATH, SHOWROOM_MODEL_PATH } from "@/lib/assets";
import { FLOOR_Y, ROOM } from "@/lib/explore/layout";
import { walkTo } from "@/lib/explore/player";
import { isTryOnMode } from "@/lib/modes";
import { useAppStore } from "@/store/useAppStore";

/** Pointer travel (px) above which a click is treated as a camera drag, not a move command. */
const DRAG_THRESHOLD = 6;

/**
 * Low-poly showroom with lighting baked into vertex colors (unlit material: no lights, no shadow maps),
 * plus an invisible ground plane for click-to-move. Hidden during try-on.
 */
export default function Showroom() {
  const hidden = useAppStore((s) => isTryOnMode(s.mode));
  const { scene } = useGLTF(SHOWROOM_MODEL_PATH, DRACO_DECODER_PATH);

  const room = useMemo(() => {
    const material = new MeshBasicNodeMaterial({ name: "showroom-baked", vertexColors: true });
    scene.traverse((o) => {
      if (o instanceof Mesh) o.material = material;
    });
    return scene;
  }, [scene]);

  const onGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (useAppStore.getState().mode !== "EXPLORE" || e.delta > DRAG_THRESHOLD) return;
    e.stopPropagation();
    walkTo([e.point.x, e.point.z]);
  };

  return (
    <group visible={!hidden}>
      <primitive object={room} />
      <mesh visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} onClick={onGroundClick}>
        <planeGeometry args={[ROOM.halfWidth * 2, ROOM.halfDepth * 2]} />
      </mesh>
    </group>
  );
}
