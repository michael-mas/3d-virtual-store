import { describe, expect, it } from "vitest";
import { INTERACT_RADIUS, PEDESTAL, PEDESTALS, PLAYER_RADIUS, ROOM, SPAWN } from "./layout";
import { approachPoint, dampTowards, nearestPedestal, resolveCollisions } from "./movement";

const obstacles = PEDESTALS.map((p) => ({ position: p.position, radius: PEDESTAL.collisionRadius }));

describe("dampTowards", () => {
  it("is frame-rate independent", () => {
    let a: [number, number] = [0, 0];
    for (let i = 0; i < 60; i++) a = dampTowards(a, [10, 0], 5, 1 / 60);
    let b: [number, number] = [0, 0];
    for (let i = 0; i < 30; i++) b = dampTowards(b, [10, 0], 5, 1 / 30);
    expect(a[0]).toBeCloseTo(b[0], 6);
  });

  it("converges to the target", () => {
    let p: [number, number] = [0, 0];
    for (let i = 0; i < 600; i++) p = dampTowards(p, [3, -2], 6, 1 / 60);
    expect(p[0]).toBeCloseTo(3, 4);
    expect(p[1]).toBeCloseTo(-2, 4);
  });
});

describe("resolveCollisions", () => {
  it("pushes the player out of a pedestal", () => {
    const [x, z] = resolveCollisions([0.1, 0.1], PLAYER_RADIUS, ROOM, obstacles);
    expect(Math.hypot(x, z)).toBeCloseTo(PLAYER_RADIUS + PEDESTAL.collisionRadius, 6);
  });

  it("keeps the player inside the room", () => {
    const [x, z] = resolveCollisions([100, -100], PLAYER_RADIUS, ROOM, obstacles);
    expect(x).toBe(ROOM.halfWidth - PLAYER_RADIUS);
    expect(z).toBe(-ROOM.halfDepth + PLAYER_RADIUS);
  });

  it("leaves free positions untouched", () => {
    expect(resolveCollisions(SPAWN, PLAYER_RADIUS, ROOM, obstacles)).toEqual(SPAWN);
  });
});

describe("nearestPedestal", () => {
  it("is null at spawn", () => {
    expect(nearestPedestal(SPAWN, PEDESTALS, INTERACT_RADIUS)).toBeNull();
  });

  it("finds the closest pedestal within range", () => {
    const target = PEDESTALS[1];
    const spot = approachPoint(target, SPAWN, 0.9);
    expect(nearestPedestal(spot, PEDESTALS, INTERACT_RADIUS)?.productId).toBe(target.productId);
  });

  it("every approach point is reachable (outside collision) and within interaction range", () => {
    for (const p of PEDESTALS) {
      const spot = approachPoint(p, SPAWN, 0.9);
      expect(resolveCollisions(spot, PLAYER_RADIUS, ROOM, obstacles)).toEqual(spot);
      expect(nearestPedestal(spot, PEDESTALS, INTERACT_RADIUS)?.productId).toBe(p.productId);
    }
  });
});

describe("layout", () => {
  it("places every catalog product on exactly one pedestal", async () => {
    const { PRODUCTS } = await import("@/lib/products");
    expect(PEDESTALS.map((p) => p.productId).sort()).toEqual(PRODUCTS.map((p) => p.id).sort());
  });
});
