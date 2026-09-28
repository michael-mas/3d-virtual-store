import { SPAWN, type Vec2 } from "./layout";

/** Explore-mode player state, shared by the ground click handler, the movement loop and the camera rig. */
export const player = {
  position: [...SPAWN] as Vec2,
  /** Where the player is walking to (set by clicks); equals position when idle. */
  target: [...SPAWN] as Vec2,
};

export function walkTo(target: Vec2) {
  player.target = [target[0], target[1]];
}
