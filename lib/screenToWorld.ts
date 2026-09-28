import { Vector3, type Camera } from "three";

export type ScreenRect = { left: number; top: number; width: number; height: number };

/**
 * Converts a client-space point (CSS px) to a world-space point on the camera ray through it,
 * `distance` units in front of the camera. `rect` is the canvas's client rect; `mirrored` accounts
 * for a CSS scaleX(-1) on the canvas (try-on stage).
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: ScreenRect,
  camera: Camera,
  distance: number,
  mirrored = false,
  out = new Vector3(),
): Vector3 {
  let ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  if (mirrored) ndcX = -ndcX;
  camera.updateMatrixWorld();
  const origin = new Vector3().setFromMatrixPosition(camera.matrixWorld);
  out.set(ndcX, ndcY, 0.5).unproject(camera).sub(origin).normalize();
  return out.multiplyScalar(distance).add(origin);
}

/** Inverse of screenToWorld: world point → client-space point (CSS px). */
export function worldToScreen(point: Vector3, rect: ScreenRect, camera: Camera, mirrored = false) {
  camera.updateMatrixWorld();
  const p = point.clone().project(camera);
  const ndcX = mirrored ? -p.x : p.x;
  return { x: rect.left + ((ndcX + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
}
