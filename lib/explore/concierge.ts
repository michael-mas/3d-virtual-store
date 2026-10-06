import { OBSTACLES, ROOM, type Vec2 } from "./layout";
import { isFree, resolveCollisions } from "./movement";

/** The concierge's footprint on the floor plan (m). */
export const CONCIERGE_RADIUS = 0.3;
/** Where it keeps itself relative to the player: ahead and to the right of the camera's view (m). */
const AHEAD = 1.15;
const ASIDE = 1.15;
/** Spring that moves it toward its spot (stiffness 1/s², damping 1/s) and its top speed (m/s). */
const STIFFNESS = 9;
const DAMPING = 6;
const MAX_SPEED = 2.4;

export type Concierge = { position: Vec2; velocity: Vec2; heading: number };

export const concierge: Concierge = { position: [0.9, 1.9], velocity: [0, 0], heading: Math.PI };

/** Fallback spots, as [ahead, aside] multiples of the preferred one, tried in order when it is blocked. */
const FALLBACKS: readonly [number, number][] = [
  [1, 1],
  [1, -1],
  [0.4, 1],
  [0.4, -1],
  [1.3, 0.4],
  [1.3, -0.4],
  [-0.6, 1],
  [-0.6, -1],
];

/**
 * The spot the concierge glides to: ahead of the player and to the right of the view (so it stays in frame
 * without hiding what the player walks toward), else the first free fallback around the player (the left side,
 * closer, behind), kept clear of pedestals, decor and walls. `forward` is the camera's view direction on the floor
 * (any length).
 */
export function conciergeSpot(player: Vec2, forward: Vec2): Vec2 {
  const f = Math.hypot(forward[0], forward[1]) || 1;
  const [fx, fz] = [forward[0] / f, forward[1] / f];
  // right = forward × up, as in cameraRelative.
  const [rx, rz] = [-fz, fx];
  let first: Vec2 | null = null;
  for (const [ahead, aside] of FALLBACKS) {
    const spot = resolveCollisions(
      [player[0] + fx * AHEAD * ahead + rx * ASIDE * aside, player[1] + fz * AHEAD * ahead + rz * ASIDE * aside],
      CONCIERGE_RADIUS,
      ROOM,
      OBSTACLES,
    );
    first ??= spot;
    if (isFree(spot, CONCIERGE_RADIUS, ROOM, OBSTACLES)) return spot;
  }
  return first!;
}

/** Yaw (about +y) that turns +z toward `to`, from `from`. */
export const headingTo = (from: Vec2, to: Vec2) => Math.atan2(to[0] - from[0], to[1] - from[1]);

/** Shortest signed angle from a to b. */
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/**
 * One step of the concierge's glide toward `spot` (damped spring, speed-capped, kept out of obstacles), turning
 * smoothly toward `face`.
 */
export function stepConcierge(c: Concierge, spot: Vec2, face: Vec2, dt: number): Concierge {
  let vx = c.velocity[0] + ((spot[0] - c.position[0]) * STIFFNESS - c.velocity[0] * DAMPING) * dt;
  let vz = c.velocity[1] + ((spot[1] - c.position[1]) * STIFFNESS - c.velocity[1] * DAMPING) * dt;
  const speed = Math.hypot(vx, vz);
  if (speed > MAX_SPEED) {
    vx *= MAX_SPEED / speed;
    vz *= MAX_SPEED / speed;
  }
  const position = resolveCollisions([c.position[0] + vx * dt, c.position[1] + vz * dt], CONCIERGE_RADIUS, ROOM, OBSTACLES);
  const turn = 1 - Math.exp(-5 * dt);
  const heading = c.heading + angleDelta(c.heading, headingTo(position, face)) * turn;
  return { position, velocity: [vx, vz], heading };
}
