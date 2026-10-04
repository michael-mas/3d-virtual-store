import { Box3, MeshBasicNodeMaterial, Vector3, type Object3D } from "three/webgpu";
import { PEDESTAL } from "@/lib/explore/layout";

/** Pedestal top relative to the product origin (meters). */
const PEDESTAL_TOP = -PEDESTAL.productOffsetY;

/**
 * How far to lift a displayed object so its lowest point rests on the pedestal, and its bounding box (after the
 * lift) as the invisible click target.
 */
export function restOnPedestal(display: Object3D) {
  display.updateMatrixWorld(true);
  const box = new Box3().setFromObject(display);
  const lift = Math.max(0, PEDESTAL_TOP - box.min.y);
  const center = box.getCenter(new Vector3());
  center.y += lift;
  return {
    lift,
    hitBox: {
      size: box.getSize(new Vector3()).toArray() as [number, number, number],
      center: center.toArray() as [number, number, number],
    },
  };
}

/** Invisible material that only writes depth: body parts hiding what passes behind them (wrist, finger). */
export const depthOnlyMaterial = (name: string) => new MeshBasicNodeMaterial({ name, colorWrite: false });
