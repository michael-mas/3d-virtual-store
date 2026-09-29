import { CANONICAL_FACE_POSITIONS, FACE_MESH_TRIANGLES, FACE_MESH_UVS } from "../faceMesh";
import type { UvPoint } from "./uvMask";

/** A point on the canonical face seen from the front, in centimeters (x toward the subject's left, y up). */
export type CmPoint = readonly [number, number];

type Tri = { a: number; b: number; c: number };

let frontTriangles: Tri[] | null = null;

/** Canonical triangles facing the camera: the face seen from the front, as a (mostly) non-overlapping 2D mesh. */
function front(): Tri[] {
  if (frontTriangles) return frontTriangles;
  const p = CANONICAL_FACE_POSITIONS;
  frontTriangles = [];
  for (let t = 0; t < FACE_MESH_TRIANGLES.length; t += 3) {
    const [a, b, c] = [FACE_MESH_TRIANGLES[t], FACE_MESH_TRIANGLES[t + 1], FACE_MESH_TRIANGLES[t + 2]];
    const area = (p[b * 3] - p[a * 3]) * (p[c * 3 + 1] - p[a * 3 + 1]) - (p[b * 3 + 1] - p[a * 3 + 1]) * (p[c * 3] - p[a * 3]);
    if (area > 1e-6) frontTriangles.push({ a, b, c });
  }
  return frontTriangles;
}

/**
 * UV of a point placed on the canonical face in centimeters (frontal projection), by barycentric interpolation in
 * the canonical mesh. Lets designs be authored in face space ("3 cm left of the nose") and follow the face mesh.
 * Points off the face snap to the UV of the nearest vertex.
 */
export function canonicalToUv([x, y]: CmPoint): UvPoint {
  const p = CANONICAL_FACE_POSITIONS;
  const uv = FACE_MESH_UVS;
  for (const { a, b, c } of front()) {
    const [ax, ay, bx, by, cx, cy] = [p[a * 3], p[a * 3 + 1], p[b * 3], p[b * 3 + 1], p[c * 3], p[c * 3 + 1]];
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    const wa = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
    const wb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
    const wc = 1 - wa - wb;
    if (wa >= -1e-9 && wb >= -1e-9 && wc >= -1e-9) {
      return [wa * uv[a * 2] + wb * uv[b * 2] + wc * uv[c * 2], wa * uv[a * 2 + 1] + wb * uv[b * 2 + 1] + wc * uv[c * 2 + 1]];
    }
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < p.length / 3; i++) {
    const dd = (p[i * 3] - x) ** 2 + (p[i * 3 + 1] - y) ** 2;
    if (dd < bestD) [best, bestD] = [i, dd];
  }
  return [uv[best * 2], uv[best * 2 + 1]];
}

/** Canonical position (cm, frontal x/y) of a landmark. */
export const landmarkCm = (i: number): CmPoint => [CANONICAL_FACE_POSITIONS[i * 3], CANONICAL_FACE_POSITIONS[i * 3 + 1]];

/** Centroid (cm) of a landmark loop. */
export function loopCenterCm(loop: readonly number[]): CmPoint {
  const pts = loop.map(landmarkCm);
  return [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
}
