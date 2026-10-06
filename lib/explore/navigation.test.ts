import { describe, expect, it } from "vitest";
import { OBSTACLES, PEDESTALS, PLAYER_RADIUS, WALK_BOUNDS, SPAWN, type Vec2 } from "./layout";
import { approachPoint, isFree, resolveCollisions, stepMotion, WALK } from "./movement";
import { buildNavMap, findPath, lineIsFree } from "./navigation";
import { advancePath, player, walkGoal, walkTo } from "./player";

/** Click-to-walk from `from` to `goal`, then the same per-frame steps as the Player component, at 60 fps. */
function clickWalk(from: Vec2, goal: Vec2, seconds = 20): Vec2 {
  player.position = [...from];
  player.velocity = [0, 0];
  walkTo(goal);
  for (let i = 0; i < seconds * 60 && player.target; i++) {
    advancePath();
    const next = stepMotion(player, [0, 0], 1 / 60, WALK, 1, { radius: PLAYER_RADIUS, obstacles: OBSTACLES });
    player.position = resolveCollisions(next.position, PLAYER_RADIUS, WALK_BOUNDS, OBSTACLES);
    player.velocity = next.velocity;
    player.target = next.target;
    if (!next.target) player.path = [];
  }
  return player.position;
}

/** Every free standing spot on a coarse grid of the salon. */
function freeSpots(step: number): Vec2[] {
  const spots: Vec2[] = [];
  for (let x = WALK_BOUNDS.minX + 0.4; x <= WALK_BOUNDS.maxX - 0.4; x += step) {
    for (let z = WALK_BOUNDS.minZ + 0.4; z <= WALK_BOUNDS.maxZ - 0.4; z += step) {
      if (isFree([x, z], PLAYER_RADIUS, WALK_BOUNDS, OBSTACLES)) spots.push([x, z]);
    }
  }
  return spots;
}

describe("click-to-walk", () => {
  it("reaches every free spot of the salon and the gallery from every other one (no position where the walk gets stuck)", () => {
    const spots = freeSpots(0.9);
    expect(spots.length).toBeGreaterThan(60);
    const stuck: string[] = [];
    // Every third pair (the salon and the gallery together are large): still every spot as a start and an end.
    for (const [i, a] of spots.entries()) {
      for (const [j, b] of spots.entries()) {
        if ((i + j) % 3 !== 0) continue;
        const end = clickWalk(a, b);
        if (Math.hypot(end[0] - b[0], end[1] - b[1]) > 0.1) stuck.push(`${a} → ${b} stopped at ${end.map((v) => v.toFixed(2))}`);
      }
    }
    expect(stuck.slice(0, 10)).toEqual([]);
  }, 120_000);

  it("walks around a bench rather than into it", () => {
    // Either side of the left bench (a capsule along z at x = -3.2).
    const end = clickWalk([-2.5, 2.2], [-4.4, 2.2]);
    expect(Math.hypot(end[0] + 4.4, end[1] - 2.2)).toBeLessThan(0.1);
  });

  it("plans straight when the way is clear, and every leg of a planned path is walkable", () => {
    const map = buildNavMap(WALK_BOUNDS, PLAYER_RADIUS, OBSTACLES);
    expect(findPath(map, SPAWN, [0, 1.6])).toEqual([[0, 1.6]]);
    const behind: Vec2 = [0, -1.2];
    const path = findPath(map, SPAWN, behind);
    expect(path.length).toBeGreaterThan(1);
    let from = SPAWN;
    for (const p of path) {
      expect(lineIsFree(map, from, p)).toBe(true);
      from = p;
    }
  });

  it("each pedestal's approach spot is reachable from spawn", () => {
    for (const p of PEDESTALS) {
      const spot = approachPoint(p, SPAWN, 0.9);
      const end = clickWalk(SPAWN, spot);
      expect(Math.hypot(end[0] - spot[0], end[1] - spot[1]), p.productId).toBeLessThan(0.1);
    }
    expect(walkGoal()).toBeNull();
  });
});
