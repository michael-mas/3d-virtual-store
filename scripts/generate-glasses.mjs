// Generates a procedural placeholder glasses model at public/models/glasses.glb (Draco-compressed).
// Node names: "Glasses" (root) > "Frame", "Lenses". Material names: "Frame", "Lens".
// Replace the output with a real model that keeps "lens" in its lens mesh/material names.
//
// Usage: npm run generate:models
import { writeFile } from "node:fs/promises";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const OUT = new URL("../public/models/glasses.glb", import.meta.url);

// Dimensions in meters; origin at the bridge, lenses in the z=0 plane, temples along -z.
const LENS_CX = 0.033;
const LENS_A = 0.026; // half width
const LENS_B = 0.02; // half height
const RIM_R = 0.0022;
const TEMPLE_R = 0.0018;

/** Superellipse outline (rounded rectangle-ish) centered at (cx, 0). */
function lensOutline(cx, a, b, n = 64, p = 2.6) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = Math.sign(c) * Math.abs(c) ** (2 / p) * a;
    const y = Math.sign(s) * Math.abs(s) ** (2 / p) * b;
    pts.push(new THREE.Vector3(cx + x, y, 0));
  }
  return pts;
}

function rim(cx) {
  const curve = new THREE.CatmullRomCurve3(lensOutline(cx, LENS_A + RIM_R * 0.5, LENS_B + RIM_R * 0.5), true);
  return new THREE.TubeGeometry(curve, 128, RIM_R, 12, true);
}

function lens(cx) {
  const shape = new THREE.Shape(lensOutline(0, LENS_A, LENS_B).map((v) => new THREE.Vector2(v.x, v.y)));
  const depth = 0.0016;
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 64 });
  geo.translate(cx, 0, -depth / 2);
  return geo;
}

function tube(points, radius, segments = 48) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 10, false);
}

function temple(side) {
  const x = side * (LENS_CX + LENS_A + RIM_R);
  return tube(
    [
      new THREE.Vector3(x, 0.008, 0),
      new THREE.Vector3(x + side * 0.004, 0.008, -0.006),
      new THREE.Vector3(x + side * 0.006, 0.007, -0.04),
      new THREE.Vector3(x + side * 0.007, 0.005, -0.11),
      new THREE.Vector3(x + side * 0.006, -0.008, -0.135),
      new THREE.Vector3(x + side * 0.004, -0.02, -0.145),
    ],
    TEMPLE_R,
    96,
  );
}

const bridge = tube(
  [
    new THREE.Vector3(-LENS_CX + LENS_A * 0.72, 0.012, 0),
    new THREE.Vector3(0, 0.016, 0.003),
    new THREE.Vector3(LENS_CX - LENS_A * 0.72, 0.012, 0),
  ],
  RIM_R * 0.8,
  32,
);

const frameGeo = mergeGeometries([rim(-LENS_CX), rim(LENS_CX), bridge, temple(-1), temple(1)]);
const lensGeo = mergeGeometries([lens(-LENS_CX), lens(LENS_CX)]);

// --- Build glTF document ---
const doc = new Document();
const buffer = doc.createBuffer();

function addMesh(name, geo, material) {
  const prim = doc.createPrimitive().setMaterial(material);
  const attr = (key, gltfName, type) =>
    prim.setAttribute(
      gltfName,
      doc.createAccessor().setType(type).setArray(new Float32Array(geo.getAttribute(key).array)).setBuffer(buffer),
    );
  attr("position", "POSITION", "VEC3");
  attr("normal", "NORMAL", "VEC3");
  attr("uv", "TEXCOORD_0", "VEC2");
  const index = geo.getIndex();
  if (index) {
    prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(index.array)).setBuffer(buffer));
  }
  return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
}

const frameMat = doc.createMaterial("Frame").setBaseColorFactor([0.1, 0.1, 0.1, 1]).setRoughnessFactor(0.5);
const lensMat = doc.createMaterial("Lens").setBaseColorFactor([1, 1, 1, 0.3]).setAlphaMode("BLEND");

const root = doc
  .createNode("Glasses")
  .addChild(addMesh("Frame", frameGeo, frameMat))
  .addChild(addMesh("Lenses", lensGeo, lensMat));
doc.createScene("Scene").addChild(root);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "draco3d.decoder": await draco3d.createDecoderModule(),
});
await doc.transform(draco());
const glb = await io.writeBinary(doc);
await writeFile(OUT, glb);
console.log(`[generate-glasses] wrote ${OUT.pathname} (${(glb.byteLength / 1024).toFixed(1)} KB)`);
