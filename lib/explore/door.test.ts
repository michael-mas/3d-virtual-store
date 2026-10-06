import { afterEach, describe, expect, it } from "vitest";
import { conciergeSpot, stepConcierge, type Concierge } from "./concierge";
import { door, DOOR_PASSABLE, doorWanted, sideOfDoor, stepDoor, walkObstacles } from "./door";
import { DOOR_CENTER, GALLERY, PLAYER_RADIUS, WALK_BOUNDS, type Vec2 } from "./layout";
import { resolveCollisions, stepMotion, WALK } from "./movement";

/** Walks straight toward `goal` for `seconds`, as the player does (a click-to-walk target, then collisions). */
function walk(from: Vec2, goal: Vec2, seconds: number, openDoor: boolean): Vec2 {
  let m = { position: from, velocity: [0, 0] as Vec2, target: goal as Vec2 | null };
  for (let i = 0; i < seconds * 60; i++) {
    if (openDoor) stepDoor(doorWanted([m.position]), 1 / 60);
    const next = stepMotion(m, [0, 0], 1 / 60, WALK, 1, { radius: PLAYER_RADIUS, obstacles: walkObstacles() });
    m = { ...next, position: resolveCollisions(next.position, PLAYER_RADIUS, WALK_BOUNDS, walkObstacles()), target: goal };
  }
  return m.position;
}

describe("gallery door", () => {
  afterEach(() => {
    door.amount = 0;
  });

  it("blocks the doorway while closed", () => {
    door.amount = 0;
    const end = walk([0, 3.2], [0, 6], 6, false);
    expect(sideOfDoor(end)).toBe(-1);
    expect(end[1]).toBeLessThan(DOOR_CENTER[1] - PLAYER_RADIUS + 0.01);
  });

  it("opens as the visitor walks up to it and lets them through", () => {
    door.amount = 0;
    const end = walk([0, 2.6], [0, 6.5], 8, true);
    expect(sideOfDoor(end)).toBe(1);
    expect(end[1]).toBeGreaterThan(6);
    expect(door.amount).toBeGreaterThanOrEqual(DOOR_PASSABLE);
  });

  it("opens for a walk that leads through it, and closes once nobody is near", () => {
    expect(doorWanted([[0, 1.5]], [[0, 3.9], [0, 8]])).toBe(true);
    expect(doorWanted([[0, -3]], [[0, 3.9], [0, 8]])).toBe(false);
    expect(doorWanted([[0, 0]], [[2, -2]])).toBe(false);
    expect(doorWanted([[0, -4]])).toBe(false);
    door.amount = 1;
    for (let i = 0; i < 120; i++) stepDoor(false, 1 / 60);
    expect(door.amount).toBe(0);
  });

  it("is passable only once mostly open", () => {
    door.amount = DOOR_PASSABLE - 0.01;
    const closed = walkObstacles().length;
    door.amount = DOOR_PASSABLE;
    expect(walkObstacles().length).toBe(closed - 1);
  });

  it("the concierge follows the visitor into the gallery, through the doorway", () => {
    door.amount = 0;
    const visitor: Vec2 = [0.5, 8.2];
    let c: Concierge = { position: [3, 1], velocity: [0, 0], heading: 0 };
    for (let i = 0; i < 20 * 60; i++) {
      stepDoor(doorWanted([visitor, c.position]), 1 / 60);
      c = stepConcierge(c, conciergeSpot(visitor, [0, 1]), visitor, 1 / 60);
    }
    expect(sideOfDoor(c.position)).toBe(1);
    expect(c.position[1]).toBeGreaterThan(GALLERY.zStart + 0.5);
    expect(c.position[1]).toBeLessThanOrEqual(WALK_BOUNDS.maxZ);
  });

  it("keeps the concierge's spot on the visitor's side of the wall", () => {
    // Facing the entrance wall from just in front of it: the spot ahead would be in the gallery.
    const spot = conciergeSpot([0, 4.0], [0, 1]);
    expect(sideOfDoor(spot)).toBe(-1);
  });
});
