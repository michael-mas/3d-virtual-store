import { readFileSync } from "node:fs";
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { domeGeometry, domePoint, edgePhi, edgeY, SKULL, type Dome } from "./geometry";

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
});

describe("fedora", () => {
  it("rises well above the skull (room for the hair) and its brim reaches out past the crown", async () => {
    const { fedoraGeometries, FEDORA_FIT } = await import("./fedora");
    const f = fedoraGeometries();
    f.crown.computeBoundingBox();
    f.brim.computeBoundingBox();
    const skullTop = SKULL.center.y + SKULL.radii.y;
    expect(f.crown.boundingBox!.max.y).toBeGreaterThan(skullTop + 0.03);
    expect(f.crown.boundingBox!.max.y).toBeLessThanOrEqual(FEDORA_FIT.top + 0.002);
    expect(f.brim.boundingBox!.max.x).toBeGreaterThan(f.crown.boundingBox!.max.x + 0.04);
  });
});
