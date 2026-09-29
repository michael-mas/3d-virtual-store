import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute } from "three";
import topology from "./faceMeshTopology.json";

export { LANDMARK_COUNT } from "./constants";
export const FACE_MESH_VERTEX_COUNT = topology.vertexCount;
export const FACE_MESH_TRIANGLES: readonly number[] = topology.triangles;
/** Canonical UVs (three.js convention, origin bottom-left), one per mesh vertex. */
export const FACE_MESH_UVS: readonly number[] = topology.uvs;
/** Canonical face positions in centimeters (x right, y up, z toward the camera). */
export const CANONICAL_FACE_POSITIONS: readonly number[] = topology.positions;
/** Closed landmark loops of the outer and inner lip contours (FaceLandmarker.FACE_LANDMARKS_LIPS). */
export const LIP_CONTOURS: { readonly outer: readonly number[]; readonly inner: readonly number[] } = topology.lips;
/** Closed landmark loops of the eyes (MediaPipe left = subject's left) and the face outline. */
export const EYE_CONTOURS: { readonly left: readonly number[]; readonly right: readonly number[] } = topology.eyes;
export const FACE_OVAL: readonly number[] = topology.faceOval;
/** Triangles (indices into the triangle list) closing the mouth opening; never painted. */
export const MOUTH_TRIANGLES: readonly number[] = topology.mouthTriangles;

/** Triangle indices without the ones spanning the mouth opening (they would cover the teeth). */
function paintableTriangles(): number[] {
  const skip = new Set(MOUTH_TRIANGLES);
  const out: number[] = [];
  for (let t = 0; t < FACE_MESH_TRIANGLES.length / 3; t++) {
    if (!skip.has(t)) out.push(FACE_MESH_TRIANGLES[t * 3], FACE_MESH_TRIANGLES[t * 3 + 1], FACE_MESH_TRIANGLES[t * 3 + 2]);
  }
  return out;
}

/**
 * Face mesh for the surface layer. Positions live in "video layer" space, rendered by an orthographic camera
 * covering [0, aspect] × [0, 1] (aspect = video width / height), i.e. the video frame in units of its height:
 * x = landmark.x · aspect (0 = left edge), y = 1 − landmark.y (0 = bottom), z = −landmark.z · aspect
 * (MediaPipe: smaller z = closer to the camera, same scale as x). Keeping the units isotropic makes the vertex
 * normals real surface normals for lighting. Winding stays counter-clockwise seen from the camera, so back faces
 * (e.g. the far side of the nose on a turned head) are culled. The mouth opening is left open.
 * Position and normal buffers are allocated once and rewritten in place on every detection.
 */
export function createFaceMeshGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(FACE_MESH_VERTEX_COUNT * 3), 3);
  position.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  const normal = new BufferAttribute(new Float32Array(FACE_MESH_VERTEX_COUNT * 3), 3);
  normal.setUsage(DynamicDrawUsage);
  geometry.setAttribute("normal", normal);
  geometry.setAttribute("uv", new Float32BufferAttribute(FACE_MESH_UVS as number[], 2));
  geometry.setIndex(paintableTriangles());
  // Always covers (part of) the frame; its bounds change every frame.
  geometry.boundingSphere = null;
  return geometry;
}

/**
 * Writes landmarks (flat x, y, z, as stored in `tracking.landmarks`) into the geometry's positions and recomputes
 * its normals, in place. Only the 468 tessellated landmarks are used.
 */
export function updateFaceMeshPositions(geometry: BufferGeometry, landmarks: ArrayLike<number>, aspect: number) {
  const position = geometry.getAttribute("position") as BufferAttribute;
  const out = position.array as Float32Array;
  for (let i = 0; i < FACE_MESH_VERTEX_COUNT; i++) {
    const j = i * 3;
    out[j] = landmarks[j] * aspect;
    out[j + 1] = 1 - landmarks[j + 1];
    out[j + 2] = -landmarks[j + 2] * aspect;
  }
  position.needsUpdate = true;
  // Reuses the existing normal attribute (three only allocates one when missing).
  geometry.computeVertexNormals();
}
