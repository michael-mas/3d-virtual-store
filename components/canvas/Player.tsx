"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { color } from "three/tsl";
import { MeshBasicNodeMaterial, Vector3, type Mesh } from "three/webgpu";
import { isDebugEnabled } from "@/lib/debug";
import { bindKeyboard, isRunning, moveAxes } from "@/lib/explore/input";
import { walkObstacles } from "@/lib/explore/door";
import { FLOOR_Y, INTERACT_RADIUS, PEDESTALS, PLAYER_RADIUS, WALK_BOUNDS, type Vec2 } from "@/lib/explore/layout";
import { cameraRelative, nearestPedestal, resolveCollisions, stepMotion, WALK } from "@/lib/explore/movement";
import { advancePath, player, walkGoal, walkTo } from "@/lib/explore/player";
import { inGallery, nearestArtwork } from "@/lib/gallery/artworks";
import { shotAt } from "@/lib/gallery/show";
import { setCinema, show, showTime } from "@/lib/gallery/stage";
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
 * Smooth acceleration/braking, circle collisions against pedestals and walls, and distance-based pedestal and
 * artwork proximity (published to the store only when it changes).
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
      const from = walkGoal() ?? player.position;
      walkTo([from[0] + fx * step, from[1] + fz * step]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gl, get, forward]);

  useFrame(({ camera }, delta) => {
    const explore = useAppStore.getState().mode === "EXPLORE";
    if (explore) {
      camera.getWorldDirection(forward);
      const axes = moveAxes();
      // Walking during a directed part of the performance takes the camera back from the director.
      if (show.playing && show.cinema && (axes[0] !== 0 || axes[1] !== 0) && shotAt(showTime())) setCinema(false);
      const input: Vec2 = cameraRelative([forward.x, forward.z], axes);
      advancePath();
      const next = stepMotion(player, input, Math.min(delta, 0.1), WALK, isRunning() ? RUN_MULTIPLIER : 1, {
        radius: PLAYER_RADIUS,
        obstacles: walkObstacles(),
      });
      const resolved = resolveCollisions(next.position, PLAYER_RADIUS, WALK_BOUNDS, walkObstacles());
      player.position = resolved;
      player.velocity = next.velocity;
      player.target = next.target;
      // Keyboard input (or arrival) ends a walk.
      if (!next.target) player.path = [];
      useAppStore.getState().setNearPedestal(nearestPedestal(player.position, PEDESTALS, INTERACT_RADIUS)?.productId ?? null);
      useAppStore.getState().setNearArtwork(nearestArtwork(player.position)?.id ?? null);
      useAppStore.getState().setInGallery(inGallery(player.position));
    } else {
      player.velocity = [0, 0];
      player.target = null;
      player.path = [];
    }

    if (marker.current) {
      marker.current.visible = explore;
      marker.current.position.set(player.position[0], FLOOR_Y + 0.005, player.position[1]);
    }
    if (targetRing.current) {
      const goal = walkGoal();
      targetRing.current.visible = explore && goal !== null;
      if (goal) targetRing.current.position.set(goal[0], FLOOR_Y + 0.006, goal[1]);
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
