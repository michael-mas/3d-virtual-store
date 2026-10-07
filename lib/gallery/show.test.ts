import { describe, expect, it } from "vitest";
import { FLOOR_Y, GALLERY } from "@/lib/explore/layout";
import { ACTS, actAt, cueAt, FIXTURES, INTERACTIVE_ACT, JOINTS, mirrorPose, poseAt, POSES, SHOW_DURATION, shotAt } from "./show";

const VISITORS: [number, number][] = [
  [0, 12.3],
  [-3, 12],
  [3, 13.5],
];
const times = (step = 0.05) => Array.from({ length: Math.ceil(SHOW_DURATION / step) + 1 }, (_, i) => i * step);

describe("Les Trois Automates", () => {
  it("has five acts and a bow, back to back", () => {
    expect(ACTS[0].start).toBe(0);
    for (let i = 1; i < ACTS.length; i++) expect(ACTS[i].start).toBe(ACTS[i - 1].end);
    expect(SHOW_DURATION).toBe(ACTS[ACTS.length - 1].end);
    expect(actAt(50).id).toBe(INTERACTIVE_ACT);
  });

  it("poses every automaton with finite joint values throughout", () => {
    for (const t of times(0.1)) {
      for (let i = 0; i < 3; i++) {
        for (const v of VISITORS) {
          const p = poseAt(t, i, v);
          for (const j of JOINTS) expect(Number.isFinite(p[j]), `${j} at ${t}`).toBe(true);
        }
      }
    }
  });

  it("moves without jumps outside the deliberate snaps (the mechanical act, the finale's two hits)", () => {
    for (const t of times(0.02)) {
      if ((t >= 22 && t < 44) || (t >= 71.4 && t < 73.4)) continue;
      for (let i = 0; i < 3; i++) {
        const a = poseAt(t, i, VISITORS[0]);
        const b = poseAt(t + 0.02, i, VISITORS[0]);
        for (const j of JOINTS) expect(Math.abs(a[j] - b[j]), `${j} at ${t}`).toBeLessThan(0.25);
      }
    }
  });

  it("in the mirror act, the outer automatons turn their heads toward the visitor", () => {
    const left = poseAt(54, 0, [-3, 12.3]);
    const right = poseAt(54, 0, [3, 12.3]);
    // Facing the audience (−z), a visitor at +x is on the automaton's left: a negative head yaw.
    expect(right.headY).toBeLessThan(left.headY);
  });

  it("bows again when the audience applauds (the encore), and opens the curtain after the three knocks", async () => {
    const { curtainAt } = await import("./show");
    expect(poseAt(83, 1, VISITORS[0], 82).lumbarX).toBeGreaterThan(poseAt(83, 1, VISITORS[0]).lumbarX + 0.3);
    expect(curtainAt(null)).toBe(0);
    expect(curtainAt(2.5)).toBe(0);
    expect(curtainAt(7)).toBe(1);
    expect(curtainAt(SHOW_DURATION)).toBe(0);
  });

  it("mirrors poses left to right and back", () => {
    const p = POSES.punchL;
    expect(mirrorPose(mirrorPose(p))).toEqual(p);
    expect(mirrorPose(p).rShX).toBe(p.lShX);
  });

  it("dims the house for the performance and brings it back at the end", () => {
    expect(cueAt(0, VISITORS[0]).house).toBe(1);
    for (const t of [10, 30, 50, 70]) expect(cueAt(t, VISITORS[0]).house).toBeLessThan(0.15);
    expect(cueAt(75, VISITORS[0]).house).toBe(0);
    expect(cueAt(SHOW_DURATION, VISITORS[0]).house).toBeCloseTo(1, 5);
    expect(cueAt(SHOW_DURATION, VISITORS[0]).letterbox).toBeCloseTo(0, 5);
  });

  it("drives six beams, and keeps flashes mild and rare", () => {
    let flashes = 0;
    let wasFlash = false;
    for (const t of times(0.02)) {
      const cue = cueAt(t, VISITORS[0]);
      expect(cue.beams).toHaveLength(FIXTURES.length);
      for (const b of cue.beams) for (const v of [...b.aim, ...b.color, b.intensity]) expect(Number.isFinite(v)).toBe(true);
      expect(cue.flash).toBeLessThanOrEqual(0.5);
      const flash = cue.flash > 0.2;
      if (flash && !wasFlash) flashes++;
      wasFlash = flash;
    }
    // Well under three flashes a second over the whole piece.
    expect(flashes).toBeLessThan(10);
  });

  it("in the mirror act, two beams find the visitor", () => {
    const cue = cueAt(55, [2.2, 12.8]);
    expect(cue.beams.filter((b) => b.aim[0] === 2.2 && b.aim[2] === 12.8)).toHaveLength(2);
  });

  it("frames every directed shot inside the gallery, and gives the camera back for the mirror act", () => {
    for (const t of times(0.1)) {
      const shot = shotAt(t);
      if (actAt(t).id === INTERACTIVE_ACT) {
        expect(shot).toBeNull();
        continue;
      }
      expect(shot).not.toBeNull();
      const [x, y, z] = shot!.position;
      expect(Math.abs(x)).toBeLessThan(GALLERY.halfWidth);
      expect(z).toBeGreaterThan(GALLERY.zStart);
      expect(z).toBeLessThan(GALLERY.zEnd);
      expect(y).toBeGreaterThan(FLOOR_Y + 0.2);
      expect(y).toBeLessThan(FLOOR_Y + GALLERY.height);
    }
  });
});
