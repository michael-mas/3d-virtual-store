import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute } from "three";
import topology from "./faceMeshTopology.json";

export { LANDMARK_COUNT } from "./constants";
export const FACE_MESH_VERTEX_COUNT = topology.vertexCount;
export const FACE_MESH_TRIANGLES: readonly number[] = topology.triangles;
/** Canonical UVs (three.js convention, origin bottom-left), one per mesh vertex. */
export const FACE_MESH_UVS: readonly number[] = topology.uvs;
/** Canonical face positions in centimeters (x right, y up, z toward the camera). */
export const CANONICAL_FACE_POSITIONS: readonly number[] = topology.positions;

/**
 * Face mesh for the surface layer. Positions live in "video layer" space, rendered by an orthographic camera
 * covering [0, 1] × [0, 1]: x = landmark.x (0 = left edge of the video frame), y = 1 − landmark.y (0 = bottom),
 * z = −landmark.z (MediaPipe: smaller z = closer to the camera, same scale as x). Winding stays counter-clockwise
 * seen from the camera, so back faces (e.g. the far side of the nose on a turned head) are culled.
 * The position buffer is allocated once and rewritten in place on every detection.
 */
export function createFaceMeshGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(FACE_MESH_VERTEX_COUNT * 3), 3);
  position.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("uv", new Float32BufferAttribute(FACE_MESH_UVS as number[], 2));
  geometry.setIndex(FACE_MESH_TRIANGLES as number[]);
  // Always covers (part of) the frame; its bounds change every frame.
  geometry.boundingSphere = null;
  return geometry;
}

/**
 * Writes landmarks (flat x, y, z, as stored in `tracking.landmarks`) into the geometry's positions, in place.
 * Only the 468 tessellated landmarks are used.
 */
export function updateFaceMeshPositions(geometry: BufferGeometry, landmarks: ArrayLike<number>) {
  const position = geometry.getAttribute("position") as BufferAttribute;
  const out = position.array as Float32Array;
  for (let i = 0; i < FACE_MESH_VERTEX_COUNT; i++) {
    const j = i * 3;
    out[j] = landmarks[j];
    out[j + 1] = 1 - landmarks[j + 1];
    out[j + 2] = -landmarks[j + 2];
  }
  position.needsUpdate = true;
}
