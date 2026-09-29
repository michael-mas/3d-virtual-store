import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, SphereGeometry } from "three/webgpu";
import { MANNEQUIN_NECK_BOTTOM_CM } from "@/lib/preview";
import { CANONICAL_FACE_POSITIONS, FACE_MESH_TRIANGLES, FACE_MESH_UVS } from "../faceMesh";

const CM = 0.01;

/**
 * Mannequin head geometry in meters, canonical face space (face toward +z, y up), unscaled:
 * - face: the MediaPipe canonical mesh with its canonical UVs, so surface-product masks apply unchanged
 *   (all triangles, mouth closed);
 * - head: the back-of-head ellipsoid of the try-on occluder (scripts/generate-occluder.mjs), slightly larger;
 * - neck: a tapered cylinder down to MANNEQUIN_NECK_BOTTOM_CM.
 */
export function createMannequinGeometry(): { face: BufferGeometry; head: BufferGeometry; neck: BufferGeometry } {
  const face = new BufferGeometry();
  face.setAttribute("position", new Float32BufferAttribute(CANONICAL_FACE_POSITIONS.map((v) => v * CM), 3));
  face.setAttribute("uv", new Float32BufferAttribute(FACE_MESH_UVS as number[], 2));
  face.setIndex(FACE_MESH_TRIANGLES as number[]);
  face.computeVertexNormals();

  const head = new SphereGeometry(1, 48, 32);
  head.scale(0.074, 0.102, 0.096);
  head.translate(0, 0.012, -0.056);

  const top = -7;
  const neck = new CylinderGeometry(4.2 * CM, 5.2 * CM, (top - MANNEQUIN_NECK_BOTTOM_CM) * CM, 40);
  neck.translate(0, ((top + MANNEQUIN_NECK_BOTTOM_CM) / 2) * CM, -3.5 * CM);

  return { face, head, neck };
}
