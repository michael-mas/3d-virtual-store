import type { Obstacle, Pedestal, Vec2 } from "./layout";

export type Bounds = { halfWidth: number; halfDepth: number };

/** Closest point to p on the obstacle's segment a–b (its center, for a circle). */
export function closestOnSegment(p: Vec2, o: Obstacle): Vec2 {
  const [ax, az] = o.a;
  const dx = o.b[0] - ax;
  const dz = o.b[1] - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.min(Math.max(((p[0] - ax) * dx + (p[1] - az) * dz) / len2, 0), 1) : 0;
  return [ax + dx * t, az + dz * t];
}

/** Collision passes per step: enough for a contact with an obstacle and a wall at once to settle. */
const PASSES = 3;

/**
 * Keeps a circle of `radius` inside the room and outside the obstacles (capsules). Simple push-out, repeated a few
 * times so simultaneous contacts settle; enough for a showroom, so no physics engine is needed.
 */
export function resolveCollisions(p: Vec2, radius: number, bounds: Bounds, obstacles: readonly Obstacle[]): Vec2 {
  let [x, z] = p;
  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false;
    for (const o of obstacles) {
      const [cx, cz] = closestOnSegment([x, z], o);
      const dx = x - cx;
      const dz = z - cz;
      const min = radius + o.radius;
      const d = Math.hypot(dx, dz);
      if (d < min) {
        // Exactly on the axis: push toward +z (the front of a pedestal).
        const nx = d > 1e-6 ? dx / d : 0;
        const nz = d > 1e-6 ? dz / d : 1;
        x = cx + nx * min;
        z = cz + nz * min;
        moved = true;
      }
    }
    const cx = Math.min(Math.max(x, -bounds.halfWidth + radius), bounds.halfWidth - radius);
    const cz = Math.min(Math.max(z, -bounds.halfDepth + radius), bounds.halfDepth - radius);
    if (cx !== x || cz !== z) moved = true;
    x = cx;
    z = cz;
    if (!moved) break;
  }
  return [x, z];
}

/** True when a circle of `radius` at p touches no obstacle and stays inside the room. */
export function isFree(p: Vec2, radius: number, bounds: Bounds, obstacles: readonly Obstacle[]): boolean {
  if (Math.abs(p[0]) > bounds.halfWidth - radius || Math.abs(p[1]) > bounds.halfDepth - radius) return false;
  return obstacles.every((o) => {
    const c = closestOnSegment(p, o);
    return Math.hypot(p[0] - c[0], p[1] - c[1]) >= radius + o.radius - 1e-9;
  });
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

/** Extra distance at which an obstacle starts deflecting the walk (m). */
const STEER_MARGIN = 0.06;

/**
 * Deflects a desired velocity around the obstacles the player is touching, so walking into a pedestal slides along
 * it instead of pushing against it (push-out alone exactly cancels a head-on walk). The inward part of the
 * velocity is removed; when `goAround` (walking to a clicked point), a near head-on approach turns into a full-speed
 * walk along the obstacle, on the side of the target, so a point behind a pedestal is reached by going around it.
 */
export function steerAround(
  position: Vec2,
  desired: Vec2,
  radius: number,
  obstacles: readonly Obstacle[],
  goAround: boolean,
): Vec2 {
  let [vx, vz] = desired;
  const speed = Math.hypot(vx, vz);
  if (speed < 1e-6) return desired;
  for (const o of obstacles) {
    const [cx, cz] = closestOnSegment(position, o);
    const dx = position[0] - cx;
    const dz = position[1] - cz;
    const d = Math.hypot(dx, dz);
    if (d > radius + o.radius + STEER_MARGIN || d < 1e-6) continue;
    const nx = dx / d;
    const nz = dz / d;
    const inward = vx * nx + vz * nz;
    if (inward >= 0) continue;
    // Slide: drop the component into the obstacle.
    vx -= inward * nx;
    vz -= inward * nz;
    if (goAround) {
      // Tangent on the side the velocity already leans to (a dead-on approach picks one side consistently).
      const side = vx * -nz + vz * nx >= 0 ? 1 : -1;
      vx = -nz * side * speed;
      vz = nx * side * speed;
    }
  }
  return [vx, vz];
}

export type Motion = {
  position: Vec2;
  velocity: Vec2;
  /** Point to walk to (click / scroll); null when steering by keyboard or idle. */
  target: Vec2 | null;
};

export type MotionParams = {
  /** Max walking speed (m/s). */
  speed: number;
  /** Rate (1/s) at which velocity approaches the desired velocity (acceleration and braking). */
  acceleration: number;
  /** Below this distance the target counts as reached. */
  arriveRadius: number;
};

export const WALK: MotionParams = { speed: 1.6, acceleration: 9, arriveRadius: 0.03 };

/**
 * One movement step. `input` is the desired direction in world XZ (length ≤ 1, e.g. from WASD relative to
 * the camera); it overrides and cancels any target. Otherwise the player "arrives" at the target, slowing
 * down as it gets close. Velocity eases toward the desired velocity, so starts and stops are smooth.
 */
export function stepMotion(
  m: Motion,
  input: Vec2,
  dt: number,
  params: MotionParams,
  speedScale = 1,
  avoid?: { radius: number; obstacles: readonly Obstacle[] },
): Motion {
  const speed = params.speed * speedScale;
  let desired: Vec2 = [0, 0];
  let target = m.target;

  const inputLength = Math.hypot(input[0], input[1]);
  if (inputLength > 1e-3) {
    target = null;
    const k = (speed * Math.min(inputLength, 1)) / inputLength;
    desired = [input[0] * k, input[1] * k];
  } else if (target) {
    const dx = target[0] - m.position[0];
    const dz = target[1] - m.position[1];
    const d = Math.hypot(dx, dz);
    if (d < params.arriveRadius) {
      target = null;
    } else {
      // Arrive: full speed far away, proportional slowdown close in.
      const s = Math.min(speed, d * params.acceleration * 0.5);
      desired = [(dx / d) * s, (dz / d) * s];
    }
  }

  if (avoid) desired = steerAround(m.position, desired, avoid.radius, avoid.obstacles, inputLength <= 1e-3);

  const a = 1 - Math.exp(-params.acceleration * dt);
  const velocity: Vec2 = [m.velocity[0] + (desired[0] - m.velocity[0]) * a, m.velocity[1] + (desired[1] - m.velocity[1]) * a];
  if (!target && inputLength <= 1e-3 && Math.hypot(velocity[0], velocity[1]) < 1e-3) {
    velocity[0] = 0;
    velocity[1] = 0;
  }
  return {
    position: [m.position[0] + velocity[0] * dt, m.position[1] + velocity[1] * dt],
    velocity,
    target,
  };
}

/**
 * Camera-relative walk direction on the floor. `forward` is the camera's view direction projected on XZ;
 * `move` is [strafe right, forward] from the keys, each in -1..1.
 */
export function cameraRelative(forward: Vec2, move: Vec2): Vec2 {
  const f = Math.hypot(forward[0], forward[1]) || 1;
  const fx = forward[0] / f;
  const fz = forward[1] / f;
  // right = forward × up = (-fz, fx)
  const x = fx * move[1] + -fz * move[0];
  const z = fz * move[1] + fx * move[0];
  const l = Math.hypot(x, z);
  return l > 1 ? [x / l, z / l] : [x, z];
}
