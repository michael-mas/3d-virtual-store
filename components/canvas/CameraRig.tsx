"use client";

import { CameraControls, PerspectiveCamera } from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial } from "three/webgpu";
import { FLOOR_Y, OBSTACLES, PEDESTAL, PEDESTALS, ROOM, productPosition } from "@/lib/explore/layout";
import { player } from "@/lib/explore/player";
import { previewFraming } from "@/lib/preview";
import { isTryOnMode } from "@/lib/modes";
import { MEDIAPIPE_VERTICAL_FOV_DEG, TRY_ON_FAR, TRY_ON_NEAR } from "@/lib/tryon/constants";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { isDebugEnabled } from "@/lib/debug";
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

/**
 * Invisible volumes the third-person camera may not enter (camera-controls' colliders: when one comes between the
 * player and the camera, the camera moves in front of it, like a spring arm). Without them the camera, 1.5 m behind
 * the player, ends up inside the entrance door, a vitrine or a plant, and the view is filled with a dark surface.
 * The room is a box seen from inside, inset from the walls; every obstacle the player walks around is a cylinder;
 * the side-wall vitrines are boxes.
 */
function createColliders(): Mesh[] {
  const material = new MeshBasicMaterial({ side: BackSide });
  const roomHeight = ROOM.height;
  const room = new Mesh(
    new BoxGeometry((ROOM.halfWidth - WALL_CLEARANCE) * 2, roomHeight, (ROOM.halfDepth - WALL_CLEARANCE) * 2),
    material,
  );
  room.position.y = FLOOR_Y + roomHeight / 2;
  const solid = new MeshBasicMaterial();
  const pedestalHeight = PEDESTAL.top - FLOOR_Y;
  const obstacles = OBSTACLES.map((o, i) => {
    const height = i < PEDESTALS.length ? pedestalHeight : DECOR_HEIGHT;
    const mesh = new Mesh(new CylinderGeometry(o.radius, o.radius, height, 12), solid);
    mesh.position.set(o.position[0], FLOOR_Y + height / 2, o.position[1]);
    return mesh;
  });
  const vitrines = [-1, 1].flatMap((side) =>
    VITRINE.z.map((z) => {
      const mesh = new Mesh(new BoxGeometry(VITRINE.depth * 2, VITRINE.top - VITRINE.bottom, VITRINE.width), solid);
      mesh.position.set(side * ROOM.halfWidth, FLOOR_Y + (VITRINE.top + VITRINE.bottom) / 2, z);
      return mesh;
    }),
  );
  const colliders = [room, ...obstacles, ...vitrines];
  for (const c of colliders) {
    c.visible = false;
    c.updateMatrixWorld(true);
  }
  return colliders;
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
  const controls = useRef<CameraControls>(null);
  const mode = useAppStore((s) => s.mode);
  const productId = useAppStore((s) => s.activeProductId);
  const reducedMotion = useReducedMotion();
  const lastPlayer = useRef<[number, number]>([...player.position]);
  const colliders = useMemo(() => createColliders(), []);
  useEffect(
    () => () => {
      for (const c of colliders) c.geometry.dispose();
      (colliders[0].material as MeshBasicMaterial).dispose();
      (colliders[1]?.material as MeshBasicMaterial | undefined)?.dispose();
    },
    [colliders],
  );

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    // EXPLORE: drag (or one finger) looks around the player; wheel/right-drag/pinch are not camera controls
    // (the wheel walks, see Player). CUSTOMIZE: regular orbit + dolly + truck around the product.
    const { ACTION } = c.constructor as typeof CameraControlsImpl;
    // Colliders only while walking: in CUSTOMIZE the camera is close to the product, above its pedestal.
    c.colliderMeshes = mode === "EXPLORE" ? colliders : [];
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
  }, [mode, productId, colliders]);

  // EXPLORE: the camera follows the player (target and camera move together; drag still orbits).
  useFrame(() => {
    const c = controls.current;
    if (!c || mode !== "EXPLORE") return;
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
      minDistance={customize ? 0.18 : 0.9}
      maxDistance={customize ? 0.6 : 3}
      minPolarAngle={customize ? 0 : Math.PI * 0.2}
      maxPolarAngle={customize ? Math.PI * 0.55 : Math.PI * 0.47}
    />
  );
}
