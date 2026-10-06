import { describe, expect, it } from "vitest";
import { conciergeSpot, headingTo, stepConcierge, type Concierge } from "./concierge";
import { OBSTACLES, PLAYER_RADIUS, ROOM, SPAWN } from "./layout";
import { isFree } from "./movement";

describe("concierge", () => {
  it("keeps ahead of the player and to the right of the view", () => {
    // Looking down -z from spawn, the right of the view is +x.
    const spot = conciergeSpot(SPAWN, [0, -1]);
    expect(spot[0]).toBeGreaterThan(SPAWN[0] + 0.5);
    expect(spot[1]).toBeLessThan(SPAWN[1]);
  });

  it("never picks a spot inside a pedestal, decor or a wall", () => {
    for (let x = -4.5; x <= 4.5; x += 0.5) {
      for (let z = -4; z <= 4; z += 0.5) {
        for (const f of [[0, -1], [1, 0], [0, 1], [-1, 0]] as [number, number][]) {
          const spot = conciergeSpot([x, z], f);
          expect(isFree(spot, PLAYER_RADIUS - 0.01, ROOM, OBSTACLES)).toBe(true);
        }
      }
    }
  });

  it("glides to its spot and turns to face the player, without overshooting far", () => {
    let c: Concierge = { position: [2, 2], velocity: [0, 0], heading: 0 };
    const spot: [number, number] = [0.8, 1.8];
    let maxOvershoot = 0;
    for (let i = 0; i < 4 * 60; i++) {
      c = stepConcierge(c, spot, SPAWN, 1 / 60);
      maxOvershoot = Math.max(maxOvershoot, spot[0] - c.position[0]);
    }
    expect(Math.hypot(c.position[0] - spot[0], c.position[1] - spot[1])).toBeLessThan(0.02);
    expect(maxOvershoot).toBeLessThan(0.15);
    expect(Math.abs(c.heading - headingTo(c.position, SPAWN))).toBeLessThan(0.01);
  });
});
