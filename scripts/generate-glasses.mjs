// Generates the procedural glasses models (Draco-compressed), one per frame style:
//   public/models/glasses-aviator.glb  — metal aviator: teardrop wire rims, double bridge, nose pads, ear tips
//   public/models/glasses-studio.glb   — acetate square frame: thick brow, keyhole-free saddle bridge, wide temples
//   public/models/glasses-crystal.glb  — acetate cat-eye: lifted outer corners, slim temples
// Node names: "Glasses" (root) > "Frame", "Lenses". Material names: "Frame", "Lens" (the app swaps materials and
// finds lenses by the "lens" substring, so a replacement model only has to keep that naming).
//
// Conventions (shared with GLASSES_ANCHOR): meters, origin at the bridge center in the lens plane, +z toward the
// viewer, temples along -z. Lenses are spherically curved (base curve), the front wraps around the face.
//
// Usage: npm run generate:models
import { writeFile } from "node:fs/promises";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const OUTLINE_POINTS = 120;

const se = (c, p) => Math.sign(c) * Math.abs(c) ** (2 / p);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------------------------
// Outlines (2D, lens-local: origin at the lens center, +x toward the temple). Always counter-clockwise.

function ensureCcw(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area < 0 ? pts.reverse() : pts;
}

/** Superellipse outline with optional per-point shaping. */
function superellipse(a, b, p, shape = (v) => v) {
  const pts = [];
  for (let i = 0; i < OUTLINE_POINTS; i++) {
    const t = (i / OUTLINE_POINTS) * Math.PI * 2;
    pts.push(shape(new THREE.Vector2(se(Math.cos(t), p) * a, se(Math.sin(t), p) * b)));
  }
  return ensureCcw(pts);
}

/** Smooth closed outline through control points, resampled evenly. */
function splineOutline(controls) {
  const curve = new THREE.CatmullRomCurve3(
    controls.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    "centripetal",
  );
  return ensureCcw(curve.getSpacedPoints(OUTLINE_POINTS).slice(0, -1).map((v) => new THREE.Vector2(v.x, v.y)));
}

/** Outward normal of a CCW outline at point i. */
function outlineNormal(pts, i) {
  const n = pts.length;
  const t = pts[(i + 1) % n].clone().sub(pts[(i - 1 + n) % n]).normalize();
  return new THREE.Vector2(t.y, -t.x);
}

/** Offsets a CCW outline outward by width(normal, point). */
function offsetOutline(pts, width) {
  return pts.map((p, i) => {
    const n = outlineNormal(pts, i);
    return p.clone().addScaledVector(n, typeof width === "number" ? width : width(n, p));
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry helpers. Every part ends up non-indexed with position/normal/uv so parts can be merged.

/** Moves vertices by z += f(x, y) and transforms normals accordingly (n' = (nx - fx·nz, ny - fy·nz, nz)). */
function deformZ(geo, f, fx, fy) {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) + f(x, y));
    n.fromBufferAttribute(nor, i);
    n.set(n.x - fx(x, y) * n.z, n.y - fy(x, y) * n.z, n.z).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return geo;
}

/** Face form: the front bends back toward the temples (z -= k·x²). */
const WRAP = 1.1;
const wrapZ = (x) => -WRAP * x * x;
const wrap = (geo) =>
  deformZ(
    geo,
    (x) => wrapZ(x),
    (x) => -2 * WRAP * x,
    () => 0,
  );

/** Mirrors a (non-indexed) geometry across x = 0, keeping front faces front-facing. */
function mirrorX(geo) {
  const out = geo.clone();
  const pos = out.getAttribute("position");
  const nor = out.getAttribute("normal");
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
    nor.setX(i, -nor.getX(i));
  }
  // Swap the 2nd and 3rd vertex of every triangle in every attribute (winding).
  for (const attr of Object.values(out.attributes)) {
    const s = attr.itemSize;
    const a = attr.array;
    for (let t = 0; t < attr.count; t += 3) {
      for (let k = 0; k < s; k++) {
        const i1 = (t + 1) * s + k;
        const i2 = (t + 2) * s + k;
        [a[i1], a[i2]] = [a[i2], a[i1]];
      }
    }
  }
  return out;
}

const symmetric = (right) => [right, mirrorX(right)];

function prepare(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
  return g;
}

/**
 * Sweeps a superellipse cross-section along a smooth curve. The section's first axis N = T × ref (for a temple with
 * ref = Y: lateral thickness; for a rim in the xy plane with ref = Z: width in the lens plane), second axis B = N × T.
 * section(t) → [halfN, halfB, exponent]. Open sweeps get end caps.
 */
function sweep(points, { closed = false, segments = 96, radial = 20, ref = Y, section }) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  const rings = closed ? segments : segments + 1;
  const positions = [];
  const uvs = [];
  const centers = [];
  const tangents = [];
  for (let i = 0; i < rings; i++) {
    const t = i / segments;
    const P = curve.getPointAt(Math.min(t, 1));
    const T = curve.getTangentAt(Math.min(t, 1));
    const N = T.clone().cross(ref).normalize();
    const B = N.clone().cross(T).normalize();
    const [a, b, p] = section(t);
    centers.push(P);
    tangents.push(T);
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      const v = P.clone()
        .addScaledVector(N, se(Math.cos(th), p) * a)
        .addScaledVector(B, se(Math.sin(th), p) * b);
      positions.push(v.x, v.y, v.z);
      uvs.push(t, j / radial);
    }
  }
  const vtx = (i) => new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
  // Pick the winding that makes side faces point away from the curve.
  const a0 = vtx(0);
  const c0 = vtx(radial);
  const b0 = vtx(1);
  const outward = c0.clone().sub(a0).cross(b0.clone().sub(a0)).dot(a0.clone().sub(centers[0])) > 0;
  const index = [];
  const quad = (a, b, c, d) => (outward ? index.push(a, c, b, b, c, d) : index.push(a, b, c, b, d, c));
  const spans = closed ? rings : rings - 1;
  for (let i = 0; i < spans; i++) {
    const next = (i + 1) % rings;
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      quad(i * radial + j, i * radial + j2, next * radial + j, next * radial + j2);
    }
  }
  if (!closed) {
    // Caps with their own vertices (flat normals), wound to face along ∓T.
    for (const [ring, dir] of [
      [0, -1],
      [rings - 1, 1],
    ]) {
      const center = positions.length / 3;
      const P = centers[ring];
      positions.push(P.x, P.y, P.z);
      uvs.push(ring / segments, 0.5);
      const first = positions.length / 3;
      for (let j = 0; j < radial; j++) {
        const v = vtx(ring * radial + j);
        positions.push(v.x, v.y, v.z);
        uvs.push(ring / segments, j / radial);
      }
      const e1 = vtx(first).sub(P);
      const e2 = vtx(first + 1).sub(P);
      const facesAlong = e1.cross(e2).dot(tangents[ring]) * dir > 0;
      for (let j = 0; j < radial; j++) {
        const j2 = (j + 1) % radial;
        if (facesAlong) index.push(center, first + j, first + j2);
        else index.push(center, first + j2, first + j);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return prepare(geo);
}

const toShape = (pts) => new THREE.Shape(pts);
const toPath = (pts) => new THREE.Path(pts);

/** Extruded, beveled slab from an outline (with optional holes), centered on z = zCenter. */
function slab(outline, { holes = [], depth, bevel, zCenter = 0 }) {
  const shape = toShape(outline);
  for (const h of holes) shape.holes.push(toPath(h));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * bevel, 0.0001),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 4,
    curveSegments: 1,
  });
  geo.translate(0, 0, zCenter - (depth - 2 * bevel) / 2);
  return prepare(geo);
}

const translate2 = (pts, cx) => pts.map((p) => new THREE.Vector2(p.x + cx, p.y));

/** Lens: the outline grown into the rim groove, a thin shell with a spherical base curve (center bulges forward). */
function lens(outline, cx, { baseCurve, inset = 0.0008, thickness = 0.0018, zCenter = 0 }) {
  const shape = offsetOutline(outline, inset);
  const geo = slab(translate2(shape, cx), { depth: thickness, bevel: 0, zCenter });
  const edgeR2 = shape.reduce((s, p) => s + p.lengthSq(), 0) / shape.length;
  const sag = (x, y) => (edgeR2 - ((x - cx) ** 2 + y * y)) / (2 * baseCurve);
  return deformZ(
    geo,
    sag,
    (x) => -(x - cx) / baseCurve,
    (_, y) => -y / baseCurve,
  );
}

/** Acetate rim: a beveled ring whose width varies around the lens (thicker brow, optional cat-eye wing). */
function acetateRim(outline, cx, { width, depth }) {
  const outer = offsetOutline(outline, width);
  return slab(translate2(outer, cx), { holes: [translate2(outline, cx)], depth, bevel: 0.0011 });
}

/** Point on the outline closest to a direction from the lens center (lens-local). */
function outlinePointToward(outline, angle) {
  const d = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  return outline.reduce((best, p) => (p.clone().normalize().dot(d) > best.clone().normalize().dot(d) ? p : best));
}

/**
 * Temple from its hinge point: along the side of the head, bending down behind the ear.
 * Head is ±7.7 cm wide at the ears, ~8 cm behind the lens plane (canonical face).
 */
function templePath(start) {
  const o = (dx, dy, dz) => start.clone().add(new THREE.Vector3(dx, dy, dz));
  return [
    o(0, 0, 0),
    o(0.002, 0, -0.02),
    o(0.008, -0.003, -0.06),
    o(0.013, -0.007, -0.088),
    o(0.014, -0.014, -0.1),
    o(0.012, -0.03, -0.111),
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// Frame styles. Each returns { frame: BufferGeometry[], lenses: BufferGeometry[] }.

function aviator() {
  const cx = 0.035;
  // Teardrop: flat-ish brow, the lower outer part drops toward the cheek.
  const outline = splineOutline([
    [-0.022, 0.0165],
    [-0.006, 0.0195],
    [0.012, 0.019],
    [0.025, 0.0135],
    [0.0295, 0.002],
    [0.0275, -0.011],
    [0.019, -0.022],
    [0.005, -0.0265],
    [-0.009, -0.0235],
    [-0.019, -0.0135],
    [-0.0245, 0.001],
  ]);
  const rimCurve = offsetOutline(outline, 0.0006).map((p) => new THREE.Vector3(p.x + cx, p.y, 0));
  const rim = wrap(sweep(rimCurve, { closed: true, segments: 160, radial: 14, ref: Z, section: () => [0.0011, 0.0013, 2.4] }));

  const topBar = wrap(
    sweep(
      [new THREE.Vector3(-0.016, 0.0168, 0), new THREE.Vector3(0, 0.0172, 0.0004), new THREE.Vector3(0.016, 0.0168, 0)],
      { segments: 40, radial: 12, ref: Z, section: () => [0.0009, 0.001, 2.2] },
    ),
  );
  const bridge = wrap(
    sweep(
      [
        new THREE.Vector3(-0.0112, 0.0085, 0),
        new THREE.Vector3(-0.006, 0.0118, 0.0012),
        new THREE.Vector3(0, 0.0128, 0.0016),
        new THREE.Vector3(0.006, 0.0118, 0.0012),
        new THREE.Vector3(0.0112, 0.0085, 0),
      ],
      { segments: 48, radial: 12, ref: Z, section: () => [0.0011, 0.0012, 2.4] },
    ),
  );

  // Nose pad arm from the inner rim, bending back to an oval pad resting on the side of the nose.
  const armStart = new THREE.Vector3(cx + outlinePointToward(outline, Math.PI * 1.1).x, -0.004, 0);
  const padCenter = new THREE.Vector3(0.0085, -0.006, -0.009);
  const arm = sweep([armStart, new THREE.Vector3(0.011, -0.004, -0.004), padCenter.clone().add(new THREE.Vector3(0.001, 0.001, 0.001))], {
    segments: 24,
    radial: 8,
    section: () => [0.0005, 0.0005, 2],
  });
  const pad = prepare(new THREE.SphereGeometry(1, 20, 14));
  pad.scale(0.0016, 0.0068, 0.0042);
  pad.rotateY(-0.9);
  pad.rotateZ(0.25);
  pad.translate(padCenter.x, padCenter.y, padCenter.z);

  // End piece: from the outer rim, a short bar back to the hinge barrel.
  const endAt = outlinePointToward(outline, 0.35);
  const ex = cx + endAt.x + 0.0008;
  const hingeY = endAt.y;
  const endPiece = wrap(
    sweep([new THREE.Vector3(ex - 0.001, hingeY, 0), new THREE.Vector3(ex + 0.002, hingeY, -0.0025), new THREE.Vector3(ex + 0.003, hingeY, -0.006)], {
      segments: 16,
      radial: 12,
      section: () => [0.0011, 0.0016, 3],
    }),
  );
  const hingeStart = new THREE.Vector3(ex + 0.003, hingeY, -0.006 + wrapZ(ex + 0.003));
  const barrel = prepare(new THREE.CylinderGeometry(0.0014, 0.0014, 0.0042, 16));
  barrel.translate(hingeStart.x, hingeStart.y, hingeStart.z);

  const path = templePath(hingeStart);
  // Thin wire temple, then a thicker acetate ear tip (last ~30 %).
  const temple = sweep(path, {
    segments: 120,
    radial: 12,
    section: (t) => {
      const tip = smoothstep(0.62, 0.72, t);
      const end = t > 0.985 ? Math.sqrt(Math.max(0, 1 - ((t - 0.985) / 0.015) ** 2)) : 1;
      const r = lerp(0.00085, 0.0019, tip) * lerp(0.35, 1, end);
      return [r * lerp(1, 0.8, tip), r * lerp(1.1, 1.25, tip), 2.4];
    },
  });

  const right = [rim, arm, pad, endPiece, barrel, temple];
  return {
    frame: [...right.flatMap(symmetric), topBar, bridge],
    lenses: symmetric(wrap(lens(outline, cx, { baseCurve: 0.085 }))),
  };
}

/** Shared acetate front + temples. */
function acetate({ outline, cx, width, depth, bridge, hingeAngle, temple }) {
  const rim = wrap(acetateRim(outline, cx, { width, depth }));
  const outer = offsetOutline(outline, width);

  // Saddle bridge: a flattened bar arching over the nose, its ends buried in the rims.
  const bridgeGeo = wrap(
    sweep(
      [
        new THREE.Vector3(-bridge.x, bridge.y, 0),
        new THREE.Vector3(-bridge.x * 0.45, bridge.y + bridge.arch * 0.8, 0.0003),
        new THREE.Vector3(0, bridge.y + bridge.arch, 0.0004),
        new THREE.Vector3(bridge.x * 0.45, bridge.y + bridge.arch * 0.8, 0.0003),
        new THREE.Vector3(bridge.x, bridge.y, 0),
      ],
      { segments: 48, radial: 18, ref: Z, section: () => [bridge.height, depth / 2 - 0.0002, 3.2] },
    ),
  );

  // Molded nose pads on the inside of the rims (part of the acetate front).
  const padCenter = new THREE.Vector3(cx - bridge.padX, -0.004, -depth / 2 - 0.0005);
  const pad = prepare(new THREE.SphereGeometry(1, 18, 12));
  pad.scale(0.0022, 0.007, 0.0026);
  pad.rotateY(-0.6);
  pad.rotateZ(0.3);
  pad.translate(padCenter.x, padCenter.y, padCenter.z);
  const pads = wrap(pad);

  // End piece: the front's outer corner extends back into a block that carries the hinge.
  const endAt = outlinePointToward(outer, hingeAngle);
  const ex = cx + endAt.x - 0.0012;
  const hingeY = endAt.y;
  const endPiece = wrap(
    sweep(
      [
        new THREE.Vector3(ex - 0.0015, hingeY, 0),
        new THREE.Vector3(ex + 0.0008, hingeY, -0.003),
        new THREE.Vector3(ex + 0.0016, hingeY, -0.0095),
      ],
      { segments: 20, radial: 16, section: () => [0.0021, temple.height * 1.05, 4] },
    ),
  );
  const hingeStart = new THREE.Vector3(ex + 0.0016, hingeY, -0.009 + wrapZ(ex + 0.0016));
  const templeGeo = sweep(templePath(hingeStart), {
    segments: 120,
    radial: 16,
    section: (t) => {
      const end = t > 0.975 ? Math.sqrt(Math.max(0, 1 - ((t - 0.975) / 0.025) ** 2)) : 1;
      const h = lerp(temple.height, temple.tipHeight, smoothstep(0.05, 0.75, t));
      return [temple.thickness * lerp(0.4, 1, end), h * lerp(0.4, 1, end), 3.4];
    },
  });

  return {
    frame: [...[rim, pads, endPiece, templeGeo].flatMap(symmetric), bridgeGeo],
    lenses: symmetric(wrap(lens(outline, cx, { baseCurve: 0.14 }))),
  };
}

function studio() {
  const a = 0.0258;
  const b = 0.0198;
  // Square-ish lens, a little wider at the top (trapezoid).
  const outline = superellipse(a, b, 3.6, (v) => new THREE.Vector2(v.x * (1 + 0.07 * (v.y / b)), v.y));
  return acetate({
    outline,
    cx: 0.0345,
    // Thick brow, slimmer lower rim.
    width: (n) => lerp(0.0033, 0.0058, smoothstep(-0.3, 0.9, n.y)),
    depth: 0.0058,
    bridge: { x: 0.0095, y: 0.0085, arch: 0.004, height: 0.0028, padX: 0.024 },
    hingeAngle: 0.45,
    temple: { height: 0.0042, tipHeight: 0.0026, thickness: 0.0015 },
  });
}

function crystal() {
  const a = 0.0248;
  const b = 0.0205;
  // Rounded lens whose outer-top corner lifts (cat-eye), inner-bottom slightly pinched.
  const outline = superellipse(a, b, 2.5, (v) => {
    const outerTop = Math.max(0, v.x / a) ** 2 * Math.max(0, v.y / b);
    const innerBottom = Math.max(0, -v.x / a) * Math.max(0, -v.y / b);
    return new THREE.Vector2(v.x * (1 + 0.08 * outerTop), v.y + 0.0075 * outerTop + 0.0018 * innerBottom);
  });
  return acetate({
    outline,
    cx: 0.0348,
    // Even rim with a flared wing at the outer-top corner.
    width: (n) => 0.0034 + 0.0055 * smoothstep(0.1, 0.75, n.x) * smoothstep(-0.1, 0.6, n.y),
    depth: 0.0052,
    bridge: { x: 0.0098, y: 0.009, arch: 0.0032, height: 0.0024, padX: 0.0235 },
    hingeAngle: 0.55,
    temple: { height: 0.0034, tipHeight: 0.0024, thickness: 0.0013 },
  });
}

// ---------------------------------------------------------------------------------------------------------------
// glTF export.

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "draco3d.decoder": await draco3d.createDecoderModule(),
});

async function write(name, { frame, lenses }) {
  const doc = new Document();
  const buffer = doc.createBuffer();

  function addMesh(meshName, parts, material) {
    const geo = mergeGeometries(parts);
    if (!geo) throw new Error(`[generate-glasses] ${name}/${meshName}: incompatible parts`);
    const prim = doc.createPrimitive().setMaterial(material);
    const attr = (key, gltfName, type) =>
      prim.setAttribute(
        gltfName,
        doc.createAccessor().setType(type).setArray(new Float32Array(geo.getAttribute(key).array)).setBuffer(buffer),
      );
    attr("position", "POSITION", "VEC3");
    attr("normal", "NORMAL", "VEC3");
    attr("uv", "TEXCOORD_0", "VEC2");
    return doc.createNode(meshName).setMesh(doc.createMesh(meshName).addPrimitive(prim));
  }

  const frameMat = doc.createMaterial("Frame").setBaseColorFactor([0.1, 0.1, 0.1, 1]).setRoughnessFactor(0.5);
  const lensMat = doc.createMaterial("Lens").setBaseColorFactor([1, 1, 1, 0.3]).setAlphaMode("BLEND");
  const root = doc
    .createNode("Glasses")
    .addChild(addMesh("Frame", frame, frameMat))
    .addChild(addMesh("Lenses", lenses, lensMat));
  doc.createScene("Scene").addChild(root);

  await doc.transform(draco());
  const glb = await io.writeBinary(doc);
  const out = new URL(`../public/models/glasses-${name}.glb`, import.meta.url);
  await writeFile(out, glb);
  console.log(`[generate-glasses] wrote ${out.pathname} (${(glb.byteLength / 1024).toFixed(1)} KB)`);
}

await write("aviator", aviator());
await write("studio", studio());
await write("crystal", crystal());
