import type { Pedestal, Vec2 } from "./layout";

/** Frame-rate independent exponential approach: moves `current` toward `target` (critically damped feel). */
export function dampTowards(current: Vec2, target: Vec2, lambda: number, dt: number, out: Vec2 = [0, 0]): Vec2 {
  const k = 1 - Math.exp(-lambda * dt);
  out[0] = current[0] + (target[0] - current[0]) * k;
  out[1] = current[1] + (target[1] - current[1]) * k;
  return out;
}

export type Bounds = { halfWidth: number; halfDepth: number };

/**
 * Keeps a circle of `radius` inside the room and outside circular obstacles (pedestals).
 * Simple push-out; enough for a showroom, so no physics engine is needed.
 */
export function resolveCollisions(
  p: Vec2,
  radius: number,
  bounds: Bounds,
  obstacles: readonly { position: Vec2; radius: number }[],
): Vec2 {
  let [x, z] = p;
  for (const o of obstacles) {
    const dx = x - o.position[0];
    const dz = z - o.position[1];
    const min = radius + o.radius;
    const d = Math.hypot(dx, dz);
    if (d < min) {
      // Exactly on the centre: push toward +z (the front of the pedestal).
      const nx = d > 1e-6 ? dx / d : 0;
      const nz = d > 1e-6 ? dz / d : 1;
      x = o.position[0] + nx * min;
      z = o.position[1] + nz * min;
    }
  }
  x = Math.min(Math.max(x, -bounds.halfWidth + radius), bounds.halfWidth - radius);
  z = Math.min(Math.max(z, -bounds.halfDepth + radius), bounds.halfDepth - radius);
  return [x, z];
}

/** Nearest pedestal within `radius` (2D distance on the floor), or null. */
export function nearestPedestal(p: Vec2, pedestals: readonly Pedestal[], radius: number): Pedestal | null {
  let best: Pedestal | null = null;
  let bestD = radius;
  for (const ped of pedestals) {
    const d = Math.hypot(p[0] - ped.position[0], p[1] - ped.position[1]);
    if (d <= bestD) {
      best = ped;
      bestD = d;
    }
  }
  return best;
}

/** A standing spot `distance` from the pedestal, on the side facing `from`. */
export function approachPoint(pedestal: Pedestal, from: Vec2, distance: number): Vec2 {
  const dx = from[0] - pedestal.position[0];
  const dz = from[1] - pedestal.position[1];
  const d = Math.hypot(dx, dz) || 1;
  return [pedestal.position[0] + (dx / d) * distance, pedestal.position[1] + (dz / d) * distance];
}
