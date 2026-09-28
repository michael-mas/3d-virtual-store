// Generates public/models/head-occluder.glb (Draco): the MediaPipe canonical face mesh
// (scripts/data/canonical_face_model.obj, Apache-2.0, cm → m) plus an ellipsoid for the back of the head,
// so glasses temples are hidden behind the head. Coordinates are MediaPipe canonical face space in meters.
//
// Usage: npm run generate:models
import { readFile, writeFile } from "node:fs/promises";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const OBJ = new URL("./data/canonical_face_model.obj", import.meta.url);
const OUT = new URL("../public/models/head-occluder.glb", import.meta.url);

// --- Canonical face (positions + triangle indices only; OBJ indices are 1-based "v/vt") ---
const positions = [];
const indices = [];
for (const line of (await readFile(OBJ, "utf8")).split("\n")) {
  const [tag, ...rest] = line.trim().split(/\s+/);
  if (tag === "v") positions.push(...rest.map((n) => Number(n) / 100));
  else if (tag === "f") indices.push(...rest.map((r) => Number(r.split("/")[0]) - 1));
}
const face = new THREE.BufferGeometry();
face.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
face.setIndex(indices);

// --- Back of head: ellipsoid behind the face surface (inside the face silhouette at the front,
// narrower than the temples at the sides so the near temple stays visible when the head turns). ---
const head = new THREE.SphereGeometry(1, 32, 24);
head.scale(0.072, 0.1, 0.095);
head.translate(0, 0.012, -0.055);
head.deleteAttribute("normal");
head.deleteAttribute("uv");

const geo = mergeGeometries([face, head]);

// --- glTF ---
const doc = new Document();
const buffer = doc.createBuffer();
const prim = doc
  .createPrimitive()
  .setAttribute(
    "POSITION",
    doc.createAccessor().setType("VEC3").setArray(new Float32Array(geo.getAttribute("position").array)).setBuffer(buffer),
  )
  .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(geo.getIndex().array)).setBuffer(buffer))
  .setMaterial(doc.createMaterial("Occluder"));
doc.createScene("Scene").addChild(doc.createNode("HeadOccluder").setMesh(doc.createMesh("HeadOccluder").addPrimitive(prim)));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "draco3d.decoder": await draco3d.createDecoderModule(),
});
await doc.transform(draco());
const glb = await io.writeBinary(doc);
await writeFile(OUT, glb);
console.log(`[generate-occluder] wrote ${OUT.pathname} (${(glb.byteLength / 1024).toFixed(1)} KB)`);
