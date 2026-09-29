import { describe, expect, it } from "vitest";
import { CANONICAL_FACE_POSITIONS, FACE_MESH_VERTEX_COUNT, LANDMARK_COUNT } from "../faceMesh";
import { mouthClosedAmount, mouthOpenness } from "./mouth";

/**
 * Canonical face as normalized landmarks, with the lower inner lip (14) moved down by `drop` cm.
 * The canonical mesh has slightly parted lips (openness ≈ 0.13); drop ≈ -0.5 closes them.
 */
function landmarks(drop = 0) {
  const out = new Float32Array(LANDMARK_COUNT * 3);
  for (let i = 0; i < FACE_MESH_VERTEX_COUNT; i++) {
    const [x, y, z] = CANONICAL_FACE_POSITIONS.slice(i * 3, i * 3 + 3);
    out.set([0.5 + x / 40, 0.5 - (y - (i === 14 ? drop : 0)) / 40, -z / 40], i * 3);
  }
  return out;
}

describe("mouth openness", () => {
  it("is near zero when the inner lips touch and grows as they part", () => {
    const upper = CANONICAL_FACE_POSITIONS[13 * 3 + 1];
    const lower = CANONICAL_FACE_POSITIONS[14 * 3 + 1];
    // Webcam measurements: closed 0.004–0.036, a smile showing teeth ≈ 0.2.
    expect(mouthOpenness(landmarks(lower - upper), 1)).toBeLessThan(0.01);
    expect(mouthOpenness(landmarks(), 1)).toBeGreaterThan(0.1);
    expect(mouthOpenness(landmarks(1.5), 1)).toBeGreaterThan(0.2);
  });

  it("is independent of the video aspect for the same face", () => {
    // Same face in a 16:9 frame: x is squeezed by 9/16 in normalized coordinates.
    const lm = landmarks(1);
    const squeezed = lm.map((v, i) => (i % 3 === 0 ? 0.5 + (v - 0.5) * (9 / 16) : v));
    expect(mouthOpenness(squeezed, 16 / 9)).toBeCloseTo(mouthOpenness(lm, 1), 5);
  });

  it("maps openness to a closed amount (1 closed → 0 open)", () => {
    expect(mouthClosedAmount(0)).toBe(1);
    expect(mouthClosedAmount(0.2)).toBe(0);
    const mid = mouthClosedAmount(0.07);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });
});
