"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { color } from "three/tsl";
import { MeshBasicNodeMaterial, Vector3, type Mesh } from "three/webgpu";
import { isDebugEnabled } from "@/lib/debug";
import { bindKeyboard, isRunning, moveAxes } from "@/lib/explore/input";
import { FLOOR_Y, INTERACT_RADIUS, OBSTACLES, PEDESTALS, PLAYER_RADIUS, ROOM, type Vec2 } from "@/lib/explore/layout";
import { cameraRelative, nearestPedestal, resolveCollisions, stepMotion, WALK } from "@/lib/explore/movement";
import { player } from "@/lib/explore/player";
import { useAppStore } from "@/store/useAppStore";

const RUN_MULTIPLIER = 1.8;
/** Metres walked per pixel of wheel scroll, and the max step per wheel event. */
const WHEEL_METRES_PER_PX = 0.004;
const WHEEL_MAX_STEP = 0.6;

/**
 * Explore-mode movement:
 * - keyboard (WASD / ZQSD / arrows, Shift to run), relative to where the camera looks;
 * - mouse wheel walks forward / backward along the view direction;
 * - click / tap on the floor walks there (secondary, mostly for touch).
 * Smooth acceleration/braking, circle collisions against pedestals and walls, and distance-based pedestal
 * proximity (published to the store only when it changes).
 */
export default function Player() {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const marker = useRef<Mesh>(null);
  const targetRing = useRef<Mesh>(null);
  const forward = useMemo(() => new Vector3(), []);

  const materials = useMemo(
    () => ({
      marker: Object.assign(new MeshBasicNodeMaterial({ transparent: true, opacity: 0.22, depthWrite: false }), {
        colorNode: color("#c8a96a"),
      }),
      target: Object.assign(new MeshBasicNodeMaterial({ transparent: true, opacity: 0.6, depthWrite: false }), {
        colorNode: color("#e2cc9a"),
      }),
    }),
    [],
  );

  useEffect(() => {
    // Debug-only handle for inspecting / scripting the player from the console or e2e checks.
    if (isDebugEnabled()) Object.assign(window, { __player: player });
  }, []);

  useEffect(() => bindKeyboard(), []);

  // Wheel = walk forward/backward (camera zoom is disabled in EXPLORE, see CameraRig).
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      if (useAppStore.getState().mode !== "EXPLORE") return;
      e.preventDefault();
      const px = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? e.deltaY * 400 : e.deltaY;
      const step = Math.max(-WHEEL_MAX_STEP, Math.min(WHEEL_MAX_STEP, -px * WHEEL_METRES_PER_PX));
      get().camera.getWorldDirection(forward);
      const [fx, fz] = cameraRelative([forward.x, forward.z], [0, 1]);
      const from = player.target ?? player.position;
      player.target = resolveCollisions([from[0] + fx * step, from[1] + fz * step], PLAYER_RADIUS, ROOM, OBSTACLES);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gl, get, forward]);

  useFrame(({ camera }, delta) => {
    const explore = useAppStore.getState().mode === "EXPLORE";
    if (explore) {
      camera.getWorldDirection(forward);
      const input: Vec2 = cameraRelative([forward.x, forward.z], moveAxes());
      if (player.target) player.target = resolveCollisions(player.target, PLAYER_RADIUS, ROOM, OBSTACLES);
      const next = stepMotion(player, input, Math.min(delta, 0.1), WALK, isRunning() ? RUN_MULTIPLIER : 1);
      const resolved = resolveCollisions(next.position, PLAYER_RADIUS, ROOM, OBSTACLES);
      player.position = resolved;
      player.velocity = next.velocity;
      player.target = next.target;
      useAppStore.getState().setNearPedestal(nearestPedestal(player.position, PEDESTALS, INTERACT_RADIUS)?.productId ?? null);
    } else {
      player.velocity = [0, 0];
      player.target = null;
    }

    if (marker.current) {
      marker.current.visible = explore;
      marker.current.position.set(player.position[0], FLOOR_Y + 0.005, player.position[1]);
    }
    if (targetRing.current) {
      targetRing.current.visible = explore && player.target !== null;
      if (player.target) targetRing.current.position.set(player.target[0], FLOOR_Y + 0.006, player.target[1]);
    }
  });

  return (
    <>
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} material={materials.marker}>
        <ringGeometry args={[PLAYER_RADIUS * 0.94, PLAYER_RADIUS, 64]} />
      </mesh>
      <mesh ref={targetRing} rotation={[-Math.PI / 2, 0, 0]} material={materials.target}>
        <ringGeometry args={[0.15, 0.17, 48]} />
      </mesh>
    </>
  );
}
