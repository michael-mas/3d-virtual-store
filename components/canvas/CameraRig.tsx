"use client";

import { CameraControls, PerspectiveCamera } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { isTryOnMode, type Mode } from "@/lib/modes";
import { MEDIAPIPE_VERTICAL_FOV_DEG, TRY_ON_FAR, TRY_ON_NEAR } from "@/lib/tryon/constants";
import { useAppStore } from "@/store/useAppStore";

type Vec3 = [number, number, number];
type Pose = { position: Vec3; target: Vec3 };

/** Customizer panel sits on the right (md+) or bottom (mobile); offset the target so the product stays visible. */
function customizePose(): Pose {
  const wide = window.innerWidth >= 768;
  return wide
    ? { position: [0.12, 0.03, 0.34], target: [0.06, -0.004, -0.03] }
    : { position: [0.1, 0.02, 0.42], target: [0, -0.055, -0.03] };
}

const POSES: Partial<Record<Mode, () => Pose>> = {
  EXPLORE: () => ({ position: [0.34, 0.16, 0.62], target: [0, -0.06, 0] }),
  CUSTOMIZE: customizePose,
};

export default function CameraRig() {
  const controls = useRef<CameraControls>(null);
  const mode = useAppStore((s) => s.mode);

  useEffect(() => {
    const pose = POSES[mode]?.();
    if (!pose || !controls.current) return;
    void controls.current.setLookAt(...pose.position, ...pose.target, true);
  }, [mode]);

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
      minDistance={customize ? 0.18 : 0.35}
      maxDistance={customize ? 0.6 : 1.6}
      maxPolarAngle={Math.PI * 0.55}
    />
  );
}
