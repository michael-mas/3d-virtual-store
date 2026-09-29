// Generates lib/tryon/faceMeshTopology.json from MediaPipe's face geometry metadata
// (scripts/data/geometry_pipeline_metadata_landmarks.pbtxt, Apache-2.0): the canonical mesh used by the face
// geometry pipeline, one vertex per face landmark (0–467, same order as FaceLandmarker's output) and 898 triangles.
// The 10 iris landmarks (468–477) are not part of the tessellation.
//
// Output (all flat arrays):
// - triangles: vertex indices, counter-clockwise seen from the front of the face
// - uvs: canonical UVs in three.js convention (origin bottom-left). The pbtxt stores v top-down, so v' = 1 - v.
// - positions: canonical face positions in centimeters (x right of the image, y up, z toward the camera)
// - lips.outer / lips.inner: closed landmark loops of the lip contours, from tasks-vision's
//   FaceLandmarker.FACE_LANDMARKS_LIPS (the official connection list shipped with @mediapipe/tasks-vision)
// - eyes.left / eyes.right / faceOval: closed landmark loops from FACE_LANDMARKS_LEFT_EYE, _RIGHT_EYE and
//   _FACE_OVAL (MediaPipe's "left" is the subject's left, i.e. the right side of an unmirrored image)
// - mouthTriangles: indices (into the triangle list) of the triangles spanning the mouth opening — all three
//   vertices on the inner lip contour. They stretch over the teeth when the mouth opens.
//
// Usage: npm run generate:models
import { readFile, writeFile } from "node:fs/promises";
import { FaceLandmarker } from "@mediapipe/tasks-vision";

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

/** Walks a set of undirected edges forming one simple cycle into an ordered loop of vertex indices. */
function loopFromEdges(edges) {
  const next = new Map();
  for (const { start, end } of edges) {
    for (const [a, b] of [[start, end], [end, start]]) next.set(a, [...(next.get(a) ?? []), b]);
  }
  if ([...next.values()].some((n) => n.length !== 2)) throw new Error("Lip contour is not a simple cycle");
  const first = edges[0].start;
  const loop = [first];
  let prev = first;
  let cur = next.get(first)[0];
  while (cur !== first) {
    loop.push(cur);
    const [a, b] = next.get(cur);
    [prev, cur] = [cur, a === prev ? b : a];
  }
  if (loop.length !== edges.length) throw new Error("Lip contour has more than one cycle");
  return loop;
}

// FACE_LANDMARKS_LIPS holds two cycles: the outer contour and the inner contour (the one through mouth corner 78).
const lipEdges = FaceLandmarker.FACE_LANDMARKS_LIPS;
const innerVertices = new Set();
for (const stack = [78]; stack.length; ) {
  const v = stack.pop();
  if (innerVertices.has(v)) continue;
  innerVertices.add(v);
  for (const e of lipEdges) {
    if (e.start === v) stack.push(e.end);
    if (e.end === v) stack.push(e.start);
  }
}
const isInner = (e) => innerVertices.has(e.start) && innerVertices.has(e.end);
const inner = loopFromEdges(lipEdges.filter(isInner));
const outer = loopFromEdges(lipEdges.filter((e) => !isInner(e)));
if (!outer.includes(61) || !inner.includes(78)) throw new Error("Unexpected lip contours");

const eyes = { left: loopFromEdges(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE), right: loopFromEdges(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE) };
const faceOval = loopFromEdges(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL);

const mouthTriangles = [];
for (let t = 0; t < triangles.length / 3; t++) {
  if ([0, 1, 2].every((k) => innerVertices.has(triangles[t * 3 + k]))) mouthTriangles.push(t);
}

await writeFile(
  OUT,
  JSON.stringify({
    source: "mediapipe/modules/face_geometry/data/geometry_pipeline_metadata_landmarks.pbtxt (Apache-2.0)",
    vertexCount: VERTEX_COUNT,
    triangles,
    uvs,
    positions,
    lips: { outer, inner },
    eyes,
    faceOval,
    mouthTriangles,
  }) + "\n",
);
console.log(
  `faceMeshTopology.json: ${VERTEX_COUNT} vertices, ${triangles.length / 3} triangles, lips ${outer.length}+${inner.length}, ` +
    `eyes ${eyes.left.length}+${eyes.right.length}, oval ${faceOval.length}, ${mouthTriangles.length} mouth triangles`,
);
