import { describe, expect, it } from "vitest";
import { FACE_MESH_UVS, LIP_CONTOURS } from "../faceMesh";
import { blurMask, contourUv, rasterizeLoops, type UvPoint } from "./uvMask";

const square = (c: number, h: number): UvPoint[] => [
  [c - h, c - h],
  [c + h, c - h],
  [c + h, c + h],
  [c - h, c + h],
];
const at = (mask: Uint8Array, size: number, u: number, v: number) =>
  mask[Math.floor(v * size) * size + Math.floor(u * size)];

describe("rasterizeLoops", () => {
  it("fills a polygon and cuts holes with the even-odd rule", () => {
    const size = 64;
    const mask = rasterizeLoops([square(0.5, 0.4), square(0.5, 0.15)], size);
    expect(at(mask, size, 0.2, 0.5)).toBe(255); // ring
    expect(at(mask, size, 0.5, 0.5)).toBe(0); // hole
    expect(at(mask, size, 0.02, 0.5)).toBe(0); // outside
  });

  it("maps row 0 to v = 0", () => {
    const size = 32;
    const mask = rasterizeLoops([[[0, 0], [1, 0], [1, 0.25], [0, 0.25]]], size);
    expect(mask[0]).toBe(255);
    expect(mask[(size - 1) * size]).toBe(0);
  });
});

describe("blurMask", () => {
  it("softens edges but keeps the interior solid and the far outside empty", () => {
    const size = 64;
    const mask = blurMask(rasterizeLoops([square(0.5, 0.25)], size), size, 3);
    expect(at(mask, size, 0.5, 0.5)).toBe(255);
    expect(at(mask, size, 0.05, 0.5)).toBe(0);
    const edge = at(mask, size, 0.25, 0.5);
    expect(edge).toBeGreaterThan(40);
    expect(edge).toBeLessThan(215);
  });
});

describe("lip mask", () => {
  it("covers the lips but not the mouth opening", () => {
    const size = 512;
    const mask = rasterizeLoops(
      [contourUv(LIP_CONTOURS.outer, FACE_MESH_UVS), contourUv(LIP_CONTOURS.inner, FACE_MESH_UVS)],
      size,
    );
    const uvOf = (i: number) => [FACE_MESH_UVS[i * 2], FACE_MESH_UVS[i * 2 + 1]] as const;
    const mid = (a: number, b: number) => {
      const [ua, va] = uvOf(a);
      const [ub, vb] = uvOf(b);
      return [(ua + ub) / 2, (va + vb) / 2] as const;
    };
    // Middle of the upper lip (outer 0 ↔ inner 13) and lower lip (outer 17 ↔ inner 14): painted.
    expect(at(mask, size, ...mid(0, 13))).toBe(255);
    expect(at(mask, size, ...mid(17, 14))).toBe(255);
    // Between the inner lip points (mouth opening): not painted. Nose tip (4): not painted.
    expect(at(mask, size, ...mid(13, 14))).toBe(0);
    expect(at(mask, size, ...uvOf(4))).toBe(0);
  });
});
