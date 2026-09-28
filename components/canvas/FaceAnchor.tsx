"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import { Matrix4, type Group } from "three/webgpu";
import { CM, GLASSES_ANCHOR } from "@/lib/tryon/constants";
import { tracking } from "@/lib/tryon/tracking";
import { useAppStore } from "@/store/useAppStore";
import HeadOccluder from "./HeadOccluder";

const CM_TO_M = new Matrix4().makeScale(CM, CM, CM);
const M_TO_CM = new Matrix4().makeScale(1 / CM, 1 / CM, 1 / CM);
/** No face: collapsed to a point 1 m in front of the camera (still drawn, invisible). */
const HIDDEN = new Matrix4().makeScale(1e-6, 1e-6, 1e-6).setPosition(0, 0, -1);

/**
 * Group driven by the smoothed MediaPipe facial transformation matrix. Children live in canonical face
 * space, in meters: matrix = cm→m · pose(cm) · m→cm. Holds the head occluder and the calibrated product.
 */
export default function FaceAnchor({ children }: { children: ReactNode }) {
  const anchor = useRef<Group>(null);
  const calibration = useAppStore((s) => s.calibrations[s.activeProductId]);

  useFrame(() => {
    const g = anchor.current;
    if (!g) return;
    // No face: collapse instead of hiding, so the product keeps being drawn (see Glasses keep-alive).
    if (tracking.hasFace) g.matrix.copy(CM_TO_M).multiply(tracking.pose).multiply(M_TO_CM);
    else g.matrix.copy(HIDDEN);
  });

  const [ax, ay, az] = GLASSES_ANCHOR;
  const [ox, oy, oz] = calibration.offset;
  return (
    <group ref={anchor} matrixAutoUpdate={false} matrix={HIDDEN}>
      <HeadOccluder />
      <group position={[ax + ox, ay + oy, az + oz]} scale={calibration.scale}>
        {children}
      </group>
    </group>
  );
}
