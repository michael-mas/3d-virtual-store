import { describe, expect, it } from "vitest";
import { FEDORA_FIT } from "@/lib/headwear/fedora";
import { hatScale, measureHair } from "./hairFit";

const W = 480;
const H = 270;
const ASPECT = 16 / 9;

/** Landmarks with only the four the measure reads: forehead (10), chin (152), the face's sides (234, 454). */
function face(top: number, bottom: number, left: number, right: number): Float32Array {
  const l = new Float32Array(478 * 3);
  const set = (i: number, x: number, y: number) => ((l[i * 3] = x), (l[i * 3 + 1] = y));
  set(10, (left + right) / 2, top);
  set(152, (left + right) / 2, bottom);
  set(234, left, (top + bottom) / 2);
  set(454, right, (top + bottom) / 2);
  return l;
}

/** A mask with hair filling a box (normalized frame coordinates). */
function hairBox(x0: number, x1: number, y0: number, y1: number): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++) for (let x = Math.floor(x0 * W); x < Math.floor(x1 * W); x++) m[y * W + x] = 255;
  return m;
}

describe("hair fit", () => {
  const lm = face(0.35, 0.75, 0.4, 0.6);

  it("measures how far the hair rises above the forehead and how wide it is", () => {
    const e = measureHair(hairBox(0.37, 0.63, 0.15, 0.4), W, H, lm, ASPECT)!;
    // 0.20 of the frame above a forehead, for a face 0.40 tall.
    expect(e.above).toBeCloseTo(0.5, 1);
    expect(e.width).toBeCloseTo(1.3, 1);
  });

  it("finds no hair on a shaved head, and nothing without a face", () => {
    expect(measureHair(new Uint8Array(W * H), W, H, lm, ASPECT)).toEqual({ above: 0, width: 0 });
    expect(measureHair(new Uint8Array(W * H), W, H, new Float32Array(478 * 3), ASPECT)).toBeNull();
  });

  it("grows the hat for voluminous hair, never shrinks it, and caps the growth", () => {
    expect(hatScale({ above: 0, width: 0 }, FEDORA_FIT)).toEqual({ x: 1, y: 1 });
    const big = hatScale({ above: 0.9, width: 1.8 }, FEDORA_FIT);
    expect(big.y).toBeGreaterThan(1.05);
    expect(big.x).toBeGreaterThan(1.05);
    expect(hatScale({ above: 5, width: 5 }, FEDORA_FIT)).toEqual({ x: 1.35, y: 1.6 });
  });
});
