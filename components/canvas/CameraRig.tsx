"use client";

import { CameraControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { FLOOR_Y, PEDESTALS, productPosition } from "@/lib/explore/layout";
import { player } from "@/lib/explore/player";
import { isTryOnMode } from "@/lib/modes";
import { MEDIAPIPE_VERTICAL_FOV_DEG, TRY_ON_FAR, TRY_ON_NEAR } from "@/lib/tryon/constants";
import { useAppStore } from "@/store/useAppStore";

type Vec3 = [number, number, number];
type Pose = { position: Vec3; target: Vec3 };

/** Third-person look-at height above the floor (roughly chest height, level with the products). */
const LOOK_HEIGHT = 0.9;
const FOLLOW_DISTANCE = 1.5;
const FOLLOW_HEIGHT = 0.3;

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

/** Customizer panel sits on the right (md+) or bottom (mobile); offset the target so the product stays visible. */
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
  return { position: [x + p[0], y + p[1], z + p[2]], target: [x + t[0], y + t[1], z + t[2]] };
}

export default function CameraRig() {
  const controls = useRef<CameraControls>(null);
  const mode = useAppStore((s) => s.mode);
  const productId = useAppStore((s) => s.activeProductId);
  const lastPlayer = useRef<[number, number]>([...player.position]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const pose = mode === "EXPLORE" ? explorePose() : mode === "CUSTOMIZE" ? customizePose(productId) : null;
    if (pose) void c.setLookAt(...pose.position, ...pose.target, true);
    lastPlayer.current = [...player.position];
  }, [mode, productId]);

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
      smoothTime={0.5}
      minDistance={customize ? 0.18 : 0.9}
      maxDistance={customize ? 0.6 : 3}
      minPolarAngle={customize ? 0 : Math.PI * 0.2}
      maxPolarAngle={customize ? Math.PI * 0.55 : Math.PI * 0.47}
    />
  );
}
