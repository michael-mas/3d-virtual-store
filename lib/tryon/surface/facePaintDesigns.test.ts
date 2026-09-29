import { describe, expect, it } from "vitest";
import { EYE_CONTOURS, FACE_MESH_UVS, LIP_CONTOURS } from "../faceMesh";
import { canonicalToUv, landmarkCm, loopCenterCm } from "./canonical";
import { FACE_PAINT_DESIGNS, rasterizeDesign, strokeOutline } from "./facePaintDesigns";

const SIZE = 256;
const at = (mask: Uint8Array, [u, v]: readonly [number, number]) =>
  mask[Math.min(SIZE - 1, Math.floor(v * SIZE)) * SIZE + Math.min(SIZE - 1, Math.floor(u * SIZE))];
const uvOf = (i: number) => [FACE_MESH_UVS[i * 2], FACE_MESH_UVS[i * 2 + 1]] as const;

describe("canonicalToUv", () => {
  it("maps landmark positions to their own UVs", () => {
    for (const i of [1, 4, 10, 33, 152, 263]) {
      const [u, v] = canonicalToUv(landmarkCm(i));
      expect(u).toBeCloseTo(uvOf(i)[0], 4);
      expect(v).toBeCloseTo(uvOf(i)[1], 4);
    }
  });

  it("keeps left/right and up/down (subject's left eye → larger u, forehead → larger v)", () => {
    expect(canonicalToUv([4, 2.6])[0]).toBeGreaterThan(canonicalToUv([-4, 2.6])[0]);
    expect(canonicalToUv([0, 7])[1]).toBeGreaterThan(canonicalToUv([0, -7])[1]);
  });
});

describe("strokeOutline", () => {
  it("offsets both sides by half the width", () => {
    const loop = strokeOutline([[0, 0], [10, 0]], [2, 2]);
    expect(loop).toEqual([[0, 1], [10, 1], [10, -1], [0, -1]]);
  });
});

describe("face paint designs", () => {
  const masks = Object.fromEntries(FACE_PAINT_DESIGNS.map((d) => [d, rasterizeDesign(d, SIZE, 1)]));

  it("never paints the eyes or the lips (their contours included)", () => {
    const contours = [...EYE_CONTOURS.left, ...EYE_CONTOURS.right, ...LIP_CONTOURS.outer, ...LIP_CONTOURS.inner];
    for (const d of FACE_PAINT_DESIGNS) {
      for (const i of contours) expect(at(masks[d], uvOf(i))).toBeLessThan(40);
      expect(at(masks[d], canonicalToUv(loopCenterCm(EYE_CONTOURS.left)))).toBe(0);
    }
  });

  it("tiger: stripes on both cheeks", () => {
    expect(at(masks.tiger, canonicalToUv([6.8, 0.6]))).toBe(255);
    expect(at(masks.tiger, canonicalToUv([-6.8, 0.6]))).toBe(255);
    expect(at(masks.tiger, canonicalToUv([0, -1.1]))).toBe(0); // nose tip
  });

  it("masquerade: around the eyes and over the nose bridge, not on the cheeks", () => {
    const eye = loopCenterCm(EYE_CONTOURS.right);
    expect(at(masks.masquerade, canonicalToUv([eye[0] - 2, eye[1]]))).toBeGreaterThan(240);
    expect(at(masks.masquerade, canonicalToUv([0, eye[1]]))).toBeGreaterThan(240);
    expect(at(masks.masquerade, canonicalToUv([-5, -3]))).toBe(0);
  });

  it("constellation: on the subject's left side only", () => {
    expect(at(masks.constellation, canonicalToUv([5.9, 0.4]))).toBe(255);
    const right = masks.constellation.reduce((n, v, i) => n + (v > 0 && i % SIZE < SIZE * 0.4 ? 1 : 0), 0);
    expect(right).toBe(0);
  });
});
