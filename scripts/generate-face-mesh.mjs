// Generates lib/tryon/faceMeshTopology.json from MediaPipe's face geometry metadata
// (scripts/data/geometry_pipeline_metadata_landmarks.pbtxt, Apache-2.0): the canonical mesh used by the face
// geometry pipeline, one vertex per face landmark (0–467, same order as FaceLandmarker's output) and 898 triangles.
// The 10 iris landmarks (468–477) are not part of the tessellation.
//
// Output (all flat arrays):
// - triangles: vertex indices, counter-clockwise seen from the front of the face
// - uvs: canonical UVs in three.js convention (origin bottom-left). The pbtxt stores v top-down, so v' = 1 - v.
// - positions: canonical face positions in centimeters (x right of the image, y up, z toward the camera)
//
// Usage: npm run generate:models
import { readFile, writeFile } from "node:fs/promises";

const PBTXT = new URL("./data/geometry_pipeline_metadata_landmarks.pbtxt", import.meta.url);
const OUT = new URL("../lib/tryon/faceMeshTopology.json", import.meta.url);
const VERTEX_COUNT = 468;

const text = await readFile(PBTXT, "utf8");
const mesh = text.slice(text.indexOf("canonical_mesh"));
if (!/vertex_type:\s*VERTEX_PT/.test(mesh) || !/primitive_type:\s*TRIANGLE/.test(mesh)) {
  throw new Error("Unexpected canonical_mesh layout (expected VERTEX_PT triangles)");
}
const vertexBuffer = [...mesh.matchAll(/vertex_buffer:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
const triangles = [...mesh.matchAll(/index_buffer:\s*(\d+)/g)].map((m) => Number(m[1]));
if (vertexBuffer.length !== VERTEX_COUNT * 5) throw new Error(`Expected ${VERTEX_COUNT} VERTEX_PT vertices`);
if (triangles.length % 3 !== 0 || triangles.some((i) => i >= VERTEX_COUNT)) throw new Error("Bad index buffer");

const round = (n) => Math.round(n * 1e6) / 1e6;
const positions = [];
const uvs = [];
for (let i = 0; i < VERTEX_COUNT; i++) {
  const [x, y, z, u, v] = vertexBuffer.slice(i * 5, i * 5 + 5);
  positions.push(x, y, z);
  uvs.push(round(u), round(1 - v));
}

await writeFile(
  OUT,
  JSON.stringify({
    source: "mediapipe/modules/face_geometry/data/geometry_pipeline_metadata_landmarks.pbtxt (Apache-2.0)",
    vertexCount: VERTEX_COUNT,
    triangles,
    uvs,
    positions,
  }) + "\n",
);
console.log(`faceMeshTopology.json: ${VERTEX_COUNT} vertices, ${triangles.length / 3} triangles`);
