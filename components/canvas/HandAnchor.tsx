"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import { Matrix4, type Group } from "three/webgpu";
import { createHandFrame, fingerPose, handFrame, wristPose, type Finger } from "@/lib/tryon/handPose";
import { tracking } from "@/lib/tryon/tracking";

/** No hand: collapsed to a point 1 m in front of the camera (still drawn, invisible). */
const HIDDEN = new Matrix4().makeScale(1e-6, 1e-6, 1e-6).setPosition(0, 0, -1);
const frame = createHandFrame();

/**
 * Group pinned to the tracked hand, in camera space (meters): the wrist (watches) or the base segment of a finger
 * (rings), see lib/tryon/handPose.ts. Collapses instead of hiding when no hand is tracked, like FaceAnchor.
 */
export default function HandAnchor({ site, children }: { site: "wrist" | Finger; children: ReactNode }) {
  const anchor = useRef<Group>(null);

  useFrame(() => {
    const g = anchor.current;
    if (!g) return;
    if (!tracking.hand.present) {
      g.matrix.copy(HIDDEN);
      return;
    }
    handFrame(tracking.hand.points, tracking.hand.handedness, frame);
    if (site === "wrist") wristPose(frame, g.matrix);
    else fingerPose(tracking.hand.points, frame, site, g.matrix);
  });

  return (
    <group ref={anchor} matrixAutoUpdate={false} matrix={HIDDEN}>
      {children}
    </group>
  );
}
