import { describe, expect, it } from "vitest";
import { resampleMask } from "./hairMask";

describe("resampleMask", () => {
  it("averages blocks into bytes and measures coverage", () => {
    // 4×2 mask: left half hair, right half background → 2×1.
    const out = new Uint8Array(2);
    const coverage = resampleMask([1, 1, 0, 0, 1, 1, 0, 0], 4, 2, out, 2, 1);
    expect(Array.from(out)).toEqual([255, 0]);
    expect(coverage).toBe(0.5);
  });

  it("handles sizes that don't divide evenly, and upsampling", () => {
    const out = new Uint8Array(4);
    resampleMask([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 3, 3, out, 2, 2);
    expect(Array.from(out)).toEqual([128, 128, 128, 128]);
    const up = new Uint8Array(4);
    resampleMask([0, 1], 2, 1, up, 4, 1);
    expect(Array.from(up)).toEqual([0, 0, 255, 255]);
  });
});
