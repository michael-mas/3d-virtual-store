import { describe, expect, it } from "vitest";
import { INTERACT_RADIUS, OBSTACLES, PEDESTAL, PEDESTALS, PLAYER_RADIUS, ROOM, SPAWN } from "./layout";
import { approachPoint, cameraRelative, nearestPedestal, resolveCollisions, steerAround, stepMotion, WALK, type Motion } from "./movement";

const obstacles = OBSTACLES;

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

  it("keeps the player out of the benches and plants", () => {
    // Middle and both ends of the bench at (-3.2, 2.2), rotated along z.
    for (const z of [2.2, 1.6, 2.8]) {
      const [x, z2] = resolveCollisions([-3.2, z], PLAYER_RADIUS, ROOM, obstacles);
      expect(Math.hypot(x + 3.2, z2 - z)).toBeGreaterThan(0.3);
    }
    // Walking into the corner plant at (4.3, 3.8) from the room.
    const [px, pz] = resolveCollisions([4.05, 3.55], PLAYER_RADIUS, ROOM, obstacles);
    expect(Math.hypot(px - 4.3, pz - 3.8)).toBeCloseTo(PLAYER_RADIUS + 0.35, 6);
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


const run = (m: Motion, input: [number, number], seconds: number, dt = 1 / 60) => {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) m = stepMotion(m, input, dt, WALK);
  return m;
};

describe("stepMotion", () => {
  const still: Motion = { position: [0, 0], velocity: [0, 0], target: null };

  it("accelerates to walking speed and stays there while a key is held", () => {
    const m = run(still, [0, -1], 1);
    expect(Math.hypot(...m.velocity)).toBeCloseTo(WALK.speed, 2);
    expect(m.position[1]).toBeLessThan(-1);
  });

  it("brakes to a stop when the key is released", () => {
    const moving = run(still, [1, 0], 1);
    const stopped = run(moving, [0, 0], 1);
    expect(stopped.velocity).toEqual([0, 0]);
    expect(stopped.position[0] - moving.position[0]).toBeLessThan(0.3);
  });

  it("normalises diagonal input (no faster diagonals)", () => {
    const m = run(still, cameraRelative([0, -1], [1, 1]), 1);
    expect(Math.hypot(...m.velocity)).toBeCloseTo(WALK.speed, 2);
  });

  it("arrives at a target without overshooting and clears it", () => {
    let m: Motion = { ...still, target: [0, -2] };
    let minZ = 0;
    for (let i = 0; i < 600; i++) {
      m = stepMotion(m, [0, 0], 1 / 60, WALK);
      minZ = Math.min(minZ, m.position[1]);
    }
    expect(m.position[1]).toBeCloseTo(-2, 1);
    expect(minZ).toBeGreaterThan(-2.05);
    expect(m.target).toBeNull();
  });

  it("keyboard input cancels the target", () => {
    const m = stepMotion({ ...still, target: [5, 5] }, [0, 1], 1 / 60, WALK);
    expect(m.target).toBeNull();
  });

  it("is roughly frame-rate independent", () => {
    const a = run(still, [0, -1], 1, 1 / 30);
    const b = run(still, [0, -1], 1, 1 / 120);
    expect(Math.abs(a.position[1] - b.position[1])).toBeLessThan(0.05);
  });
});

describe("cameraRelative", () => {
  it("maps forward/strafe to the camera's view on the floor", () => {
    // Camera looking down -Z: forward = -Z, right = +X.
    expect(cameraRelative([0, -1], [0, 1])).toEqual([0, -1]);
    const right = cameraRelative([0, -1], [1, 0]);
    expect(right[0]).toBeCloseTo(1);
    expect(right[1]).toBeCloseTo(0);
    // Camera looking down +X: forward = +X, right = +Z.
    const r2 = cameraRelative([1, 0], [1, 0]);
    expect(r2[0]).toBeCloseTo(0);
    expect(r2[1]).toBeCloseTo(1);
  });
});

/** Walks to `target` for `seconds` at 60 fps with the same steps as the Player component. */
function walk(from: [number, number], target: [number, number], seconds: number, avoid = true): Motion {
  let m: Motion = { position: from, velocity: [0, 0], target: resolveCollisions(target, PLAYER_RADIUS, ROOM, obstacles) };
  for (let i = 0; i < seconds * 60; i++) {
    const next = stepMotion(m, [0, 0], 1 / 60, WALK, 1, avoid ? { radius: PLAYER_RADIUS, obstacles } : undefined);
    m = { ...next, position: resolveCollisions(next.position, PLAYER_RADIUS, ROOM, obstacles) };
  }
  return m;
}

describe("walking around obstacles", () => {
  it("a point behind a pedestal is reached by going around it (push-out alone gets stuck against it)", () => {
    const behind: [number, number] = [0, -1.2];
    const stuck = walk([0, 3], behind, 10, false);
    expect(Math.hypot(stuck.position[0] - behind[0], stuck.position[1] - behind[1])).toBeGreaterThan(1);
    const around = walk([0, 3], behind, 10);
    expect(Math.hypot(around.position[0] - behind[0], around.position[1] - behind[1])).toBeLessThan(0.1);
  });

  it("every pedestal's front is reachable from every other pedestal's front", () => {
    const fronts = PEDESTALS.map((p) => approachPoint(p, [p.position[0], p.position[1] + 1], 0.9));
    for (const a of fronts) {
      for (const b of fronts) {
        const m = walk(a, b, 15);
        expect(Math.hypot(m.position[0] - b[0], m.position[1] - b[1]), `${a} → ${b}`).toBeLessThan(0.15);
      }
    }
  });

  it("keyboard walking slides along an obstacle instead of turning", () => {
    // Touching the central pedestal from the front, pushing diagonally into it: only the sideways part remains.
    const at: [number, number] = [0, PLAYER_RADIUS + PEDESTAL.collisionRadius];
    const [vx, vz] = steerAround(at, [1, -1], PLAYER_RADIUS, obstacles, false);
    expect(vx).toBeCloseTo(1, 6);
    expect(vz).toBeCloseTo(0, 6);
  });
});

describe("pedestal footprint", () => {
  /** Holds a direction key for `seconds` (60 fps), as the Player component does. */
  function hold(from: [number, number], dir: [number, number], seconds: number): [number, number] {
    let m: Motion = { position: from, velocity: [0, 0], target: null };
    for (let i = 0; i < seconds * 60; i++) {
      const next = stepMotion(m, dir, 1 / 60, WALK, 1, { radius: PLAYER_RADIUS, obstacles });
      m = { ...next, position: resolveCollisions(next.position, PLAYER_RADIUS, ROOM, obstacles) };
    }
    return m.position;
  }

  it("blocks only close to the slender column, so the player walks past it freely", () => {
    // Pedestals are thin columns now: the collision circle stays close to them.
    expect(PEDESTAL.collisionRadius).toBeLessThan(0.3);
    const [x, z] = hold([0.6, 2.5], [0, -1], 2.5);
    expect(x).toBeCloseTo(0.6, 1);
    expect(z).toBeLessThan(-1);
  });

  it("walking head-on into a pedestal, then sideways, moves on", () => {
    const blocked = hold([0, 2.5], [0, -1], 2);
    expect(blocked[1]).toBeCloseTo(PLAYER_RADIUS + PEDESTAL.collisionRadius, 2);
    const after = hold(blocked, [1, 0], 1);
    expect(after[0]).toBeGreaterThan(1);
  });
});
