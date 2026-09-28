import { SPAWN, type Vec2 } from "./layout";
import type { Motion } from "./movement";

/** Explore-mode player state, shared by input handlers, the movement loop and the camera rig. */
export const player: Motion = {
  position: [...SPAWN] as Vec2,
  velocity: [0, 0],
  target: null,
};

/** Walk to a floor point (click / tap). Keyboard input cancels it. */
export function walkTo(target: Vec2) {
  player.target = [target[0], target[1]];
}
