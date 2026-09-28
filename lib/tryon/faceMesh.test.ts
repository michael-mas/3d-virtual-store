import type { BufferAttribute } from "three";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_FACE_POSITIONS,
  FACE_MESH_TRIANGLES,
  FACE_MESH_UVS,
  FACE_MESH_VERTEX_COUNT,
  LANDMARK_COUNT,
  createFaceMeshGeometry,
  updateFaceMeshPositions,
} from "./faceMesh";
import { copyLandmarks } from "./tracking";

/** Sum of signed triangle areas projected on the XY plane (> 0 = counter-clockwise seen from +Z). */
function signedArea(p: ArrayLike<number>) {
  let area = 0;
  for (let t = 0; t < FACE_MESH_TRIANGLES.length; t += 3) {
    const [a, b, c] = [FACE_MESH_TRIANGLES[t], FACE_MESH_TRIANGLES[t + 1], FACE_MESH_TRIANGLES[t + 2]];
    const abx = p[b * 3] - p[a * 3], aby = p[b * 3 + 1] - p[a * 3 + 1];
    const acx = p[c * 3] - p[a * 3], acy = p[c * 3 + 1] - p[a * 3 + 1];
    area += abx * acy - aby * acx;
  }
  return area;
}

/** A frontal face as FaceLandmarker would report it: canonical cm → normalized image coordinates. */
function frontalLandmarks() {
  const out = new Float32Array(LANDMARK_COUNT * 3);
  for (let i = 0; i < FACE_MESH_VERTEX_COUNT; i++) {
    const [x, y, z] = CANONICAL_FACE_POSITIONS.slice(i * 3, i * 3 + 3);
    out.set([0.5 + x / 40, 0.5 - y / 40, -z / 40], i * 3);
  }
  return out;
}

describe("face mesh topology (MediaPipe canonical mesh)", () => {
  it("has 468 vertices, 898 triangles and one UV per vertex", () => {
    expect(FACE_MESH_VERTEX_COUNT).toBe(468);
    expect(FACE_MESH_TRIANGLES.length).toBe(898 * 3);
    expect(FACE_MESH_UVS.length).toBe(468 * 2);
    expect(Math.max(...FACE_MESH_TRIANGLES)).toBe(467);
  });

  it("uses three.js UV orientation: forehead (10) above chin (152), subject's right eye (33) on the left", () => {
    const v = (i: number) => FACE_MESH_UVS[i * 2 + 1];
    const u = (i: number) => FACE_MESH_UVS[i * 2];
    expect(v(10)).toBeGreaterThan(v(152));
    expect(u(33)).toBeLessThan(u(263));
  });

  it("winds counter-clockwise seen from the front of the canonical face", () => {
    expect(signedArea(CANONICAL_FACE_POSITIONS)).toBeGreaterThan(0);
  });
});

describe("updateFaceMeshPositions", () => {
  it("maps landmarks to the video layer (y up, z toward the camera) and keeps the winding", () => {
    const geometry = createFaceMeshGeometry();
    const landmarks = frontalLandmarks();
    updateFaceMeshPositions(geometry, landmarks);
    const p = geometry.getAttribute("position").array;
    expect(p[1 * 3]).toBeCloseTo(landmarks[1 * 3]);
    expect(p[1 * 3 + 1]).toBeCloseTo(1 - landmarks[1 * 3 + 1]);
    expect(p[1 * 3 + 2]).toBeCloseTo(-landmarks[1 * 3 + 2]);
    // The most forward canonical vertex (nose tip) is the closest to the camera → largest z in the layer.
    const argmax = (a: number[]) => a.indexOf(Math.max(...a));
    const zs = Array.from({ length: 468 }, (_, i) => p[i * 3 + 2]);
    const canonicalZ = Array.from({ length: 468 }, (_, i) => CANONICAL_FACE_POSITIONS[i * 3 + 2]);
    expect(argmax(zs)).toBe(argmax(canonicalZ));
    expect(signedArea(p)).toBeGreaterThan(0);
  });

  it("rewrites the same buffer in place", () => {
    const geometry = createFaceMeshGeometry();
    const position = geometry.getAttribute("position") as BufferAttribute;
    const before = position.array;
    const version = position.version;
    updateFaceMeshPositions(geometry, frontalLandmarks());
    updateFaceMeshPositions(geometry, frontalLandmarks());
    expect(geometry.getAttribute("position")).toBe(position);
    expect(position.array).toBe(before);
    expect(position.version).toBe(version + 2);
  });
});

describe("copyLandmarks", () => {
  it("flattens x, y, z into a preallocated array", () => {
    const out = new Float32Array(LANDMARK_COUNT * 3);
    copyLandmarks([{ x: 0.1, y: 0.2, z: -0.3 }, { x: 0.4, y: 0.5, z: 0.6 }], out);
    expect(Array.from(out.slice(0, 6))).toEqual([0.1, 0.2, -0.3, 0.4, 0.5, 0.6].map(Math.fround));
  });
});
