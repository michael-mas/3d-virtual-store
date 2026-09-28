"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { color } from "three/tsl";
import { MeshBasicNodeMaterial, type Mesh } from "three/webgpu";
import { isDebugEnabled } from "@/lib/debug";
import { FLOOR_Y, INTERACT_RADIUS, PEDESTAL, PEDESTALS, PLAYER_RADIUS, ROOM } from "@/lib/explore/layout";
import { dampTowards, nearestPedestal, resolveCollisions } from "@/lib/explore/movement";
import { player } from "@/lib/explore/player";
import { useAppStore } from "@/store/useAppStore";

const SPEED_DAMPING = 3.5; // 1/s — exponential approach rate toward the click target
const OBSTACLES = PEDESTALS.map((p) => ({ position: p.position, radius: PEDESTAL.collisionRadius }));

/**
 * Explore-mode movement: damped motion toward the clicked point, circle collisions against pedestals and
 * room bounds, and distance-based pedestal proximity (published to the store only when it changes).
 */
export default function Player() {
  const marker = useRef<Mesh>(null);
  const targetRing = useRef<Mesh>(null);

  const materials = useMemo(
    () => ({
      marker: Object.assign(new MeshBasicNodeMaterial({ transparent: true, opacity: 0.35, depthWrite: false }), {
        colorNode: color("#e0e7ff"),
      }),
      target: Object.assign(new MeshBasicNodeMaterial({ transparent: true, opacity: 0.5, depthWrite: false }), {
        colorNode: color("#818cf8"),
      }),
    }),
    [],
  );

  useEffect(() => {
    // Debug-only handle for inspecting / scripting the player from the console or e2e checks.
    if (isDebugEnabled()) Object.assign(window, { __player: player });
  }, []);

  useFrame((_, delta) => {
    const explore = useAppStore.getState().mode === "EXPLORE";
    if (explore) {
      // Keep the target itself reachable, then move toward it.
      player.target = resolveCollisions(player.target, PLAYER_RADIUS, ROOM, OBSTACLES);
      const next = dampTowards(player.position, player.target, SPEED_DAMPING, Math.min(delta, 0.1));
      player.position = resolveCollisions(next, PLAYER_RADIUS, ROOM, OBSTACLES);
      useAppStore.getState().setNearPedestal(nearestPedestal(player.position, PEDESTALS, INTERACT_RADIUS)?.productId ?? null);
    }

    const moving = Math.hypot(player.target[0] - player.position[0], player.target[1] - player.position[1]) > 0.05;
    if (marker.current) {
      marker.current.visible = explore;
      marker.current.position.set(player.position[0], FLOOR_Y + 0.005, player.position[1]);
    }
    if (targetRing.current) {
      targetRing.current.visible = explore && moving;
      targetRing.current.position.set(player.target[0], FLOOR_Y + 0.006, player.target[1]);
    }
  });

  return (
    <>
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} material={materials.marker}>
        <ringGeometry args={[PLAYER_RADIUS * 0.82, PLAYER_RADIUS, 48]} />
      </mesh>
      <mesh ref={targetRing} rotation={[-Math.PI / 2, 0, 0]} material={materials.target}>
        <ringGeometry args={[0.12, 0.18, 32]} />
      </mesh>
    </>
  );
}
