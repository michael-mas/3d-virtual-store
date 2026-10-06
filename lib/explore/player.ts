import { OBSTACLES, PLAYER_RADIUS, SPAWN, WALK_BOUNDS, type Vec2 } from "./layout";
import type { Motion } from "./movement";
import { buildNavMap, findPath, type NavMap } from "./navigation";

export type PlayerState = Motion & {
  /** Waypoints still to walk (click / tap / wheel), ending at the goal; `target` is the first of them. */
  path: Vec2[];
};

/** Explore-mode player state, shared by input handlers, the movement loop and the camera rig. */
export const player: PlayerState = {
  position: [...SPAWN] as Vec2,
  velocity: [0, 0],
  target: null,
  path: [],
};

let navMap: NavMap | null = null;

/** Walk to a floor point (click / tap / wheel), along a path around the obstacles. Keyboard input cancels it. */
export function walkTo(goal: Vec2) {
  // Planned with the gallery door open: it opens as the visitor walks up to it.
  navMap ??= buildNavMap(WALK_BOUNDS, PLAYER_RADIUS, OBSTACLES);
  player.path = findPath(navMap, player.position, goal);
  player.target = player.path[0] ?? null;
}

/** The point the player is finally walking to, if any. */
export const walkGoal = (): Vec2 | null => player.path[player.path.length - 1] ?? null;

/** Within this distance of an intermediate waypoint, the walk turns toward the next one (m). */
const WAYPOINT_REACHED = 0.15;

/** Moves on to the next waypoint once the current one is reached; clears the path when the walk ends. */
export function advancePath() {
  if (!player.target) {
    player.path = [];
    return;
  }
  const [x, z] = player.position;
  while (player.path.length > 1 && Math.hypot(player.path[0][0] - x, player.path[0][1] - z) < WAYPOINT_REACHED) {
    player.path.shift();
  }
  player.target = player.path[0] ?? player.target;
}
