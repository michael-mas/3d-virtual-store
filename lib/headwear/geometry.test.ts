import { readFileSync } from "node:fs";
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { domeGeometry, domePoint, edgePhi, edgeY, SKULL, wigEnd, wigPoint, type Dome, type WigShape } from "./geometry";

const dome: Dome = { scale: [1.04, 1.03, 1.04], edgeFront: 0.066, edgeBack: 0.03 };

describe("headwear geometry", () => {
  it("encloses the canonical forehead, which occludes what is behind it in try-on", () => {
    const obj = readFileSync(new URL("../../scripts/data/canonical_face_model.obj", import.meta.url), "utf8");
    const { center: c, radii: r } = SKULL;
    let worst = 0;
    for (const line of obj.split("\n")) {
      if (!line.startsWith("v ")) continue;
      const [x, y, z] = line.split(/\s+/).slice(1, 4).map((v) => Number(v) / 100);
      if (y <= 0.03) continue;
      worst = Math.max(worst, ((x - c.x) / r.x) ** 2 + ((y - c.y) / r.y) ** 2 + ((z - c.z) / r.z) ** 2);
    }
    expect(worst).toBeLessThan(0.93);
  });

  it("cuts the dome along a line lower at the back than at the front", () => {
    expect(edgeY(dome, 0)).toBeCloseTo(0.066, 6);
    expect(edgeY(dome, Math.PI)).toBeCloseTo(0.03, 6);
    expect(domePoint(dome, 0, edgePhi(dome, 0)).y).toBeCloseTo(0.066, 6);
  });

  it("has outward normals", () => {
    const g = domeGeometry(dome, 24, 12);
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    const i = 6 * 24 + 3; // a vertex mid-way down
    const radial = new Vector3().fromBufferAttribute(p, i).sub(SKULL.center);
    expect(new Vector3().fromBufferAttribute(n, i).dot(radial)).toBeGreaterThan(0);
  });

  it("leaves the face open: a wig ends at the hairline in front and lower at the sides and back", () => {
    const bob: WigShape = { scale: [1.12, 1.1, 1.08], hairline: 0.052, length: -0.045, faceHalfAngle: 0.55, flare: 0.5 };
    expect(wigEnd(bob, 0)).toBeCloseTo(0.052, 6);
    expect(wigEnd(bob, Math.PI / 2)).toBeCloseTo(-0.045, 6);
    expect(wigEnd(bob, Math.PI)).toBeCloseTo(-0.045, 6);
    // Below the head's widest line the hair falls straight down (and flares), outside the skull.
    const side = wigPoint(bob, Math.PI / 2, 1);
    expect(side.y).toBeCloseTo(-0.045, 6);
    expect(side.x).toBeGreaterThan(SKULL.radii.x * 1.12);
  });
});
