"use client";

import { CameraControls, PerspectiveCamera } from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial } from "three/webgpu";
import { door, DOOR_PASSABLE } from "@/lib/explore/door";
import { DOOR_OBSTACLE, FLOOR_Y, GALLERY, OBSTACLES, PEDESTAL, PEDESTALS, ROOM, STAGE_OBSTACLES, WALK_BOUNDS, WALL_OBSTACLES, productPosition, type Obstacle } from "@/lib/explore/layout";
import { player } from "@/lib/explore/player";
import { getArtwork } from "@/lib/gallery/artworks";
import { cameraFocus } from "@/lib/gallery/interactions";
import { shotAt } from "@/lib/gallery/show";
import { show, showTime } from "@/lib/gallery/stage";
import { previewFraming } from "@/lib/preview";
import { isTryOnMode } from "@/lib/modes";
import { MEDIAPIPE_VERTICAL_FOV_DEG, TRY_ON_FAR, TRY_ON_NEAR } from "@/lib/tryon/constants";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { isDebugEnabled } from "@/lib/debug";
import { NO_REFLECTION_LAYER } from "@/lib/layers";
import { useAppStore } from "@/store/useAppStore";

type Vec3 = [number, number, number];
type Pose = { position: Vec3; target: Vec3 };

/** Third-person look-at height above the floor (roughly chest height, level with the products). */
const LOOK_HEIGHT = 0.9;
const FOLLOW_DISTANCE = 1.5;
const FOLLOW_HEIGHT = 0.3;

/**
 * The camera keeps this far from the walls (m): clear of the door handles and plaques, and less than the player's
 * own clearance, so the follow target is always inside the room collider.
 */
const WALL_CLEARANCE = 0.28;
/** Side-wall vitrines and artwork stick out further: their own boxes (depth from the wall, m). */
const VITRINE = { depth: 0.34, width: 1.7, bottom: 0.4, top: 2.4, z: [-2.4, 0, 2.4] };
/** Decor collider height (plants, benches, consoles), above anything the camera could pass over. */
const DECOR_HEIGHT = 2.2;

/** Walls keep the camera this much further away than their own thickness (m). */
const WALL_CAMERA_CLEARANCE = 0.18;

/** A capsule on the floor plan, extruded up: a cylinder at each end and a box between them. */
function extrude(o: Obstacle, height: number, material: MeshBasicMaterial, inflate = 0): Mesh[] {
  const radius = o.radius + inflate;
  const ends = [o.a, o.b].map((p) => {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, height, 12), material);
    mesh.position.set(p[0], FLOOR_Y + height / 2, p[1]);
    return mesh;
  });
  const length = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]);
  if (length < 1e-6) return ends.slice(0, 1);
  const box = new Mesh(new BoxGeometry(length, height, radius * 2), material);
  box.position.set((o.a[0] + o.b[0]) / 2, FLOOR_Y + height / 2, (o.a[1] + o.b[1]) / 2);
  box.rotation.y = -Math.atan2(o.b[1] - o.a[1], o.b[0] - o.a[0]);
  return [...ends, box];
}

/**
 * Invisible volumes the third-person camera may not enter (camera-controls' colliders: when one comes between the
 * player and the camera, the camera moves in front of it, like a spring arm). Without them the camera, 1.5 m behind
 * the player, ends up inside a wall, a vitrine or a plant, and the view is filled with a dark surface.
 * The salon and the gallery share a box seen from inside, inset from the outer walls; the walls between them, and
 * every obstacle the player walks around, are extruded from the floor plan; the side-wall vitrines are boxes; the
 * gallery door is a separate collider, in force while it is closed.
 */
function createColliders(): { fixed: Mesh[]; door: Mesh[] } {
  const material = new MeshBasicMaterial({ side: BackSide });
  const roomHeight = ROOM.height;
  const width = WALK_BOUNDS.maxX - WALK_BOUNDS.minX - WALL_CLEARANCE * 2;
  const depth = WALK_BOUNDS.maxZ - WALK_BOUNDS.minZ - WALL_CLEARANCE * 2;
  const room = new Mesh(new BoxGeometry(width, roomHeight, depth), material);
  room.position.set((WALK_BOUNDS.minX + WALK_BOUNDS.maxX) / 2, FLOOR_Y + roomHeight / 2, (WALK_BOUNDS.minZ + WALK_BOUNDS.maxZ) / 2);
  const solid = new MeshBasicMaterial();
  const pedestalHeight = PEDESTAL.top - FLOOR_Y;
  const obstacles = OBSTACLES.flatMap((o, i) =>
    WALL_OBSTACLES.includes(o)
      ? extrude(o, GALLERY.height, solid, WALL_CAMERA_CLEARANCE)
      : extrude(o, i < PEDESTALS.length ? pedestalHeight : STAGE_OBSTACLES.includes(o) ? GALLERY.stage.height : DECOR_HEIGHT, solid),
  );
  const vitrines = [-1, 1].flatMap((side) =>
    VITRINE.z.map((z) => {
      const mesh = new Mesh(new BoxGeometry(VITRINE.depth * 2, VITRINE.top - VITRINE.bottom, VITRINE.width), solid);
      mesh.position.set(side * ROOM.halfWidth, FLOOR_Y + (VITRINE.top + VITRINE.bottom) / 2, z);
      return mesh;
    }),
  );
  const doorColliders = extrude(DOOR_OBSTACLE, GALLERY.door.height, solid, WALL_CAMERA_CLEARANCE);
  const fixed = [room, ...obstacles, ...vitrines];
  for (const c of [...fixed, ...doorColliders]) {
    c.visible = false;
    c.updateMatrixWorld(true);
  }
  return { fixed, door: doorColliders };
}

/** Behind the player, facing the nearest pedestal (or -Z at spawn). */
function explorePose(): Pose {
  const [px, pz] = player.position;
  const nearest = PEDESTALS.reduce((a, b) =>
    Math.hypot(a.position[0] - px, a.position[1] - pz) < Math.hypot(b.position[0] - px, b.position[1] - pz) ? a : b,
  );
  let dx = px - nearest.position[0];
  let dz = pz - nearest.position[1];
  const d = Math.hypot(dx, dz);
  [dx, dz] = d > 1e-3 ? [dx / d, dz / d] : [0, 1];
  const target: Vec3 = [px, FLOOR_Y + LOOK_HEIGHT, pz];
  return {
    position: [px + dx * FOLLOW_DISTANCE, target[1] + FOLLOW_HEIGHT, pz + dz * FOLLOW_DISTANCE],
    target,
  };
}

/**
 * Customizer panel sits on the right (md+) or bottom (mobile); offset the target so the product stays visible.
 * Surface products are previewed on the mannequin head: look higher and stand farther back.
 */
function customizePose(productId: string): Pose {
  const [x, y, z] = productPosition(productId);
  const wide = window.innerWidth >= 768;
  const [p, t]: [Vec3, Vec3] = wide
    ? [
        [0.12, 0.03, 0.34],
        [0.06, -0.004, -0.03],
      ]
    : [
        [0.1, 0.02, 0.42],
        [0, -0.055, -0.03],
      ];
  const { liftY, distanceScale: k } = previewFraming(productId);
  return {
    position: [x + p[0] * k, y + liftY + p[1] * k, z + p[2] * k],
    target: [x + t[0] * k, y + liftY + t[1] * k, z + t[2] * k],
  };
}

export default function CameraRig() {
  // Every view camera (explore/customize, try-on) sees the transmissive layer; only the floor reflection skips it.
  const viewCamera = useThree((s) => s.camera);
  useEffect(() => {
    viewCamera.layers.enable(NO_REFLECTION_LAYER);
  }, [viewCamera]);

  const controls = useRef<CameraControls>(null);
  const mode = useAppStore((s) => s.mode);
  const productId = useAppStore((s) => s.activeProductId);
  const reducedMotion = useReducedMotion();
  const lastPlayer = useRef<[number, number]>([...player.position]);
  // Kept for the app's lifetime (never disposed: see Concierge on memoized GPU resources).
  const colliders = useMemo(() => createColliders(), []);
  const withDoor = useMemo(() => [...colliders.fixed, ...colliders.door], [colliders]);
  const doorClosed = useRef(true);
  const directed = useRef(false);
  const showCinema = useAppStore((s) => s.showPlaying && s.showCinema);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    // EXPLORE: drag (or one finger) looks around the player; wheel/right-drag/pinch are not camera controls
    // (the wheel walks, see Player). CUSTOMIZE: regular orbit + dolly + truck around the product.
    const { ACTION } = c.constructor as typeof CameraControlsImpl;
    // Colliders only while walking: in CUSTOMIZE the camera is close to the product, above its pedestal.
    doorClosed.current = door.amount < DOOR_PASSABLE;
    c.colliderMeshes = mode === "EXPLORE" ? (doorClosed.current ? withDoor : colliders.fixed) : [];
    if (mode === "EXPLORE") {
      c.mouseButtons = { left: ACTION.ROTATE, middle: ACTION.NONE, right: ACTION.NONE, wheel: ACTION.NONE };
      c.touches = { one: ACTION.TOUCH_ROTATE, two: ACTION.NONE, three: ACTION.NONE };
    } else {
      c.mouseButtons = { left: ACTION.ROTATE, middle: ACTION.DOLLY, right: ACTION.TRUCK, wheel: ACTION.DOLLY };
      c.touches = { one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY_TRUCK, three: ACTION.TOUCH_TRUCK };
    }
    // Debug-only handle for scripted views (screenshots, demo GIF).
    if (isDebugEnabled()) Object.assign(window, { __cameraControls: c });
    const pose = mode === "EXPLORE" ? explorePose() : mode === "CUSTOMIZE" ? customizePose(productId) : null;
    if (pose) void c.setLookAt(...pose.position, ...pose.target, true);
    lastPlayer.current = [...player.position];
  }, [mode, productId, colliders, withDoor]);

  // EXPLORE: the camera follows the player (target and camera move together; drag still orbits).
  useFrame(() => {
    const c = controls.current;
    if (!c || mode !== "EXPLORE") return;
    const closed = door.amount < DOOR_PASSABLE;
    // The performance: the director's shot list has the camera (no colliders: it goes on the stage, behind it…).
    const shot = show.playing && show.cinema ? shotAt(showTime()) : null;
    if (shot) {
      if (!directed.current) c.colliderMeshes = [];
      directed.current = true;
      void c.setLookAt(...shot.position, ...shot.target, false);
      lastPlayer.current = [...player.position];
      return;
    }
    if (directed.current) {
      // Back to the visitor: behind them, facing the stage.
      directed.current = false;
      doorClosed.current = closed;
      c.colliderMeshes = closed ? withDoor : colliders.fixed;
      const [px, pz] = player.position;
      void c.setLookAt(px, FLOOR_Y + LOOK_HEIGHT + 0.45, pz - 1.7, px, FLOOR_Y + LOOK_HEIGHT, pz + 0.5, true);
      lastPlayer.current = [px, pz];
      return;
    }
    // A label's button was used: turn to the work (from behind the visitor), so its answer is seen.
    const focus = cameraFocus.id ? getArtwork(cameraFocus.id) : undefined;
    if (cameraFocus.id) {
      cameraFocus.id = null;
      if (focus) {
        const [px, pz] = player.position;
        let [dx, dz] = [px - focus.center[0], pz - focus.center[2]];
        const d = Math.hypot(dx, dz);
        // Under (or at) the work: look from the entrance side.
        [dx, dz] = d > 0.6 ? [dx / d, dz / d] : [0, -1];
        if (focus.kind === "installation") {
          // The rain hangs overhead and the explore camera cannot look up: stand back at its height instead.
          const [cx, , cz] = focus.center;
          void c.setLookAt(cx + dx * 2.8, FLOOR_Y + 2.0, cz + dz * 2.8, cx, FLOOR_Y + 2.35, cz, true);
        } else {
          const lift = focus.kind === "sculpture" ? 0.35 : focus.kind === "performance" ? 1.4 : 0;
          // Close works from a little further back, so the whole work is in view.
          const back = Math.min(Math.max(2.4 - d, 0.6), 1.4);
          void c.setLookAt(px + dx * back, FLOOR_Y + 1.55, pz + dz * back, focus.center[0], focus.center[1] + lift, focus.center[2], true);
        }
        lastPlayer.current = [px, pz];
      }
    }
    // The closed gallery door stops the camera too.
    if (closed !== doorClosed.current) {
      doorClosed.current = closed;
      c.colliderMeshes = closed ? withDoor : colliders.fixed;
    }
    const [px, pz] = player.position;
    const [lx, lz] = lastPlayer.current;
    if (Math.abs(px - lx) + Math.abs(pz - lz) < 1e-5) return;
    lastPlayer.current = [px, pz];
    void c.moveTo(px, FLOOR_Y + LOOK_HEIGHT, pz, false);
  });

  if (isTryOnMode(mode)) {
    // Matches MediaPipe's face geometry camera: at the origin, looking down -Z, 63° vertical FOV.
    // Aspect follows the canvas, which the stage sizes to the video aspect.
    return (
      <PerspectiveCamera
        makeDefault
        position={[0, 0, 0]}
        fov={MEDIAPIPE_VERTICAL_FOV_DEG}
        near={TRY_ON_NEAR}
        far={TRY_ON_FAR}
      />
    );
  }

  const customize = mode === "CUSTOMIZE";
  return (
    <CameraControls
      ref={controls}
      makeDefault
      // Reduced motion: near-instant camera moves instead of 0.5 s glides.
      smoothTime={reducedMotion ? 0.08 : 0.5}
      // The director's shots go further, lower and higher than a visitor's camera.
      minDistance={customize ? 0.18 : showCinema ? 0.1 : 0.9}
      maxDistance={customize ? 0.6 : showCinema ? 12 : 3}
      minPolarAngle={customize ? 0 : showCinema ? 0.02 : Math.PI * 0.2}
      maxPolarAngle={customize ? Math.PI * 0.55 : showCinema ? Math.PI * 0.8 : Math.PI * 0.47}
    />
  );
}
