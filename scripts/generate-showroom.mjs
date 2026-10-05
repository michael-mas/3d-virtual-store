// Generates public/models/showroom.glb (Draco): a low-poly showroom with lighting baked into vertex colors
// (COLOR_0, linear). Rendered unlit at runtime, so it costs no lights or shadow maps.
// Layout (room size, pedestals) comes from lib/explore/showroom-layout.json, shared with the runtime.
//
// Usage: npm run generate:models
import { readFile, writeFile } from "node:fs/promises";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const layout = JSON.parse(await readFile(new URL("../lib/explore/showroom-layout.json", import.meta.url), "utf8"));
const OUT = new URL("../public/models/showroom.glb", import.meta.url);

// One pedestal per slot; products are assigned to slots in registry order at runtime.
const { floorY, room, pedestal, slots: pedestals } = layout;
const HW = room.halfWidth;
const HD = room.halfDepth;
const CEIL = floorY + room.height;

// ---------------------------------------------------------------- palette (linear albedo)
// A dark luxury salon: black marble, smoked-walnut fluting, brushed brass, warm 2700 K light.
const C = (r, g, b) => new THREE.Color(r, g, b);
const MARBLE = C(0.032, 0.03, 0.029);
const GROUT = C(0.012, 0.011, 0.01);
const FLUTING = C(0.075, 0.058, 0.045);
const PLASTER = C(0.05, 0.047, 0.045);
const CEILING = C(0.02, 0.02, 0.021);
const BRASS = C(0.62, 0.45, 0.2);
const PLINTH = C(0.05, 0.048, 0.046);
const VELVET = C(0.2, 0.035, 0.04);
const CERAMIC = C(0.03, 0.03, 0.03);
const FOLIAGE = C(0.05, 0.11, 0.06);
const WARM = C(1.0, 0.76, 0.5);

// ---------------------------------------------------------------- lights (baked)
// Values are pre-tone-mapping (ACES at runtime). Spots are cones (`dir`, inner/outer cosines); points have none.
const AMBIENT = C(0.03, 0.028, 0.026);
const spot = (x, y, z, intensity, range, inner = 0.93, outer = 0.72, dir = new THREE.Vector3(0, -1, 0)) => ({
  pos: new THREE.Vector3(x, y, z),
  color: WARM.clone().multiplyScalar(intensity),
  range,
  dir: dir.clone().normalize(),
  inner,
  outer,
});
const lights = [
  // A tight downlight on each pedestal: pools of light on a dark floor.
  ...pedestals.map((p) => spot(p.position[0], CEIL - 0.05, p.position[1], 3.2, 2.2, 0.975, 0.9)),
  // Wall washers: scallops of light grazing the fluted walls.
  ...[-4, -2.4, -0.8, 0.8, 2.4, 4].map((x) => spot(x, CEIL - 0.05, -HD + 0.45, 2.2, 2.4, 0.96, 0.8, new THREE.Vector3(0, -1, -0.32))),
  ...[-3.2, -1.6, 0, 1.6, 3.2].flatMap((z) => [
    spot(-HW + 0.45, CEIL - 0.05, z, 2.0, 2.4, 0.96, 0.8, new THREE.Vector3(-0.32, -1, 0)),
    spot(HW - 0.45, CEIL - 0.05, z, 2.0, 2.4, 0.96, 0.8, new THREE.Vector3(0.32, -1, 0)),
  ]),
  // Soft fill so the salon reads in the shadows.
  { pos: new THREE.Vector3(0, CEIL - 0.3, 1.5), color: C(0.16, 0.13, 0.1), range: 4 },
  { pos: new THREE.Vector3(0, CEIL - 0.3, -2), color: C(0.12, 0.1, 0.08), range: 4 },
];

// Circles on the floor that receive contact shadows (pedestals, benches, plants).
const shadowCasters = [
  ...pedestals.map((p) => ({ x: p.position[0], z: p.position[1], r: pedestal.radiusBottom + 0.02, strength: 0.75, falloff: 0.22 })),
];

const _n = new THREE.Vector3();
const _l = new THREE.Vector3();
/**
 * Bakes lighting into vertex colors. `emissive` (a color or a function of the position) replaces lighting.
 * `gloss` adds a view-independent sheen proportional to the incoming light (brass, lacquer).
 */
function bake(geo, albedo, { emissive = null, ao = null, gloss = 0 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nor, i);
    let c;
    if (emissive) {
      c = typeof emissive === "function" ? emissive(p) : emissive.clone();
    } else {
      const light = AMBIENT.clone();
      for (const L of lights) {
        _l.copy(L.pos).sub(p);
        const d = _l.length();
        _l.normalize();
        const lambert = Math.max(0, _n.dot(_l));
        const atten = 1 / (1 + (d / L.range) ** 2);
        let cone = 1;
        if (L.dir) {
          const cos = -_l.dot(L.dir);
          const t = Math.min(Math.max((cos - L.outer) / (L.inner - L.outer), 0), 1);
          cone = t * t * (3 - 2 * t);
        }
        light.add(L.color.clone().multiplyScalar(lambert * atten * cone));
      }
      c = light.clone().multiply(albedo);
      if (gloss) c.add(light.multiplyScalar(gloss * 0.12));
      // Ambient occlusion: creases where walls meet the floor and the ceiling.
      const wallDist = Math.min(HW - Math.abs(p.x), HD - Math.abs(p.z));
      const floorDist = p.y - floorY;
      let occ = 1 - 0.45 * Math.exp(-wallDist / 0.35) * Math.exp(-Math.max(floorDist, 0) / 0.5);
      occ *= 1 - 0.4 * Math.exp(-wallDist / 0.3) * Math.exp(-Math.max(CEIL - p.y, 0) / 0.4);
      // Contact shadows on the floor.
      if (floorDist < 0.02) {
        for (const s of shadowCasters) {
          const d = Math.hypot(p.x - s.x, p.z - s.z) - s.r;
          occ *= 1 - s.strength * Math.exp(-Math.max(d, 0) / s.falloff);
        }
      }
      if (ao) occ *= ao(p);
      c.multiplyScalar(occ);
    }
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.deleteAttribute("uv");
  return g;
}

const parts = [];
const at = (geo, x, y, z, ry = 0) => {
  geo.rotateY(ry);
  geo.translate(x, y, z);
  return geo;
};

// ---------------------------------------------------------------- floor: large black marble slabs, fine joints
const TILE = 1.25;
const JOINT = 0.006;
function floorParts() {
  const out = [bake(new THREE.PlaneGeometry(HW * 2, HD * 2, 1, 1).rotateX(-Math.PI / 2).translate(0, floorY - 0.002, 0), GROUT)];
  for (let x = -HW; x < HW - 1e-6; x += TILE) {
    for (let z = -HD; z < HD - 1e-6; z += TILE) {
      const w = Math.min(TILE, HW - x) - JOINT;
      const d = Math.min(TILE, HD - z) - JOINT;
      const tile = new THREE.PlaneGeometry(w, d, Math.ceil(w / 0.12), Math.ceil(d / 0.12))
        .rotateX(-Math.PI / 2)
        .translate(x + JOINT / 2 + w / 2, floorY, z + JOINT / 2 + d / 2);
      out.push(bake(tile, MARBLE));
    }
  }
  return out;
}

// ---------------------------------------------------------------- walls: black plinth, walnut fluting, brass line, plaster
const PLINTH_H = 0.14;
const FLUTE_TOP = 2.55;
const FLUTE = 0.11;
/** One wall along its local x (centered), facing +z, then placed with `at`. */
function wallParts(width) {
  const out = [];
  // Plinth.
  out.push(new THREE.BoxGeometry(width, PLINTH_H, 0.03, Math.ceil(width / 0.2), 1, 1).translate(0, PLINTH_H / 2, 0.015));
  // Fluting: half-round vertical flutes.
  const n = Math.floor(width / FLUTE);
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + (i + 0.5) * (width / n);
    const flute = new THREE.CylinderGeometry(FLUTE / 2, FLUTE / 2, FLUTE_TOP - PLINTH_H, 4, 9, true, -Math.PI / 2, Math.PI);
    out.push(flute.scale(1, 1, 0.45).translate(x, PLINTH_H + (FLUTE_TOP - PLINTH_H) / 2, 0));
  }
  return out;
}
function placeWall(width, ry, x, z) {
  const flutes = wallParts(width).map((g) => at(g, x, floorY, z, ry));
  const [plinth, ...rest] = flutes;
  parts.push(bake(plinth, PLINTH));
  for (const g of rest) parts.push(bake(g, FLUTING, { gloss: 0.3 }));
  // Back plane behind the flutes, plaster above, a brass cornice line between them.
  parts.push(bake(at(new THREE.PlaneGeometry(width, FLUTE_TOP, Math.ceil(width / 0.25), 4).translate(0, FLUTE_TOP / 2, -0.001), x, floorY, z, ry), GROUT));
  const above = room.height - FLUTE_TOP;
  parts.push(bake(at(new THREE.PlaneGeometry(width, above, Math.ceil(width / 0.2), 6).translate(0, FLUTE_TOP + above / 2, 0), x, floorY, z, ry), PLASTER));
  parts.push(bake(at(new THREE.BoxGeometry(width, 0.022, 0.05, Math.ceil(width / 0.2), 1, 1).translate(0, FLUTE_TOP + 0.011, 0.02), x, floorY, z, ry), BRASS, { gloss: 1 }));
}
placeWall(HW * 2, 0, 0, -HD); // back
placeWall(HW * 2, Math.PI, 0, HD); // front
placeWall(HD * 2, Math.PI / 2, -HW, 0); // left
placeWall(HD * 2, -Math.PI / 2, HW, 0); // right

// ---------------------------------------------------------------- ceiling, downlights
parts.push(bake(new THREE.PlaneGeometry(HW * 2, HD * 2, 20, 18).rotateX(Math.PI / 2).translate(0, CEIL, 0), CEILING));
const downlight = (x, z, r = 0.07) => {
  parts.push(bake(new THREE.CircleGeometry(r, 20).rotateX(Math.PI / 2).translate(x, CEIL - 0.004, z), null, { emissive: C(3.2, 2.5, 1.7) }));
  parts.push(bake(new THREE.RingGeometry(r, r + 0.018, 24).rotateX(Math.PI / 2).translate(x, CEIL - 0.003, z), null, { emissive: C(0.25, 0.18, 0.08) }));
};
for (const p of pedestals) downlight(p.position[0], p.position[1]);
for (const x of [-4, -2.4, -0.8, 0.8, 2.4, 4]) downlight(x, -HD + 0.45, 0.05);
for (const z of [-3.2, -1.6, 0, 1.6, 3.2]) {
  downlight(-HW + 0.45, z, 0.05);
  downlight(HW - 0.45, z, 0.05);
}

// ---------------------------------------------------------------- back wall: backlit arches framed in brass
const ARCH_W = 0.95;
const ARCH_R = ARCH_W / 2;
const ARCH_BOTTOM = 0.55;
const ARCH_H = 2.0;
function archShape(halfWidth, bottom, height) {
  const shape = new THREE.Shape();
  const r = halfWidth;
  shape.moveTo(-r, bottom);
  shape.lineTo(r, bottom);
  shape.lineTo(r, bottom + height - r);
  shape.absarc(0, bottom + height - r, r, 0, Math.PI, false);
  shape.lineTo(-r, bottom);
  return shape;
}
for (const x of [-3.7, -1.85, 0, 1.85, 3.7]) {
  const frame = new THREE.ShapeGeometry(archShape(ARCH_R + 0.035, ARCH_BOTTOM - 0.035, ARCH_H + 0.07), 24);
  parts.push(bake(at(frame, x, floorY, -HD + 0.065), BRASS, { gloss: 1 }));
  // Warm glow, brighter toward the top of the arch.
  const glow = new THREE.ShapeGeometry(archShape(ARCH_R, ARCH_BOTTOM, ARCH_H), 24);
  parts.push(
    bake(at(glow, x, floorY, -HD + 0.07), null, {
      emissive: (p) => {
        const t = Math.min(Math.max((p.y - (floorY + ARCH_BOTTOM)) / ARCH_H, 0), 1);
        return C(0.1, 0.06, 0.03).lerp(C(0.7, 0.46, 0.24), t * t);
      },
    }),
  );
  // A small brass shelf at the arch's foot.
  parts.push(bake(at(new THREE.BoxGeometry(ARCH_W + 0.12, 0.025, 0.14), x, floorY + ARCH_BOTTOM - 0.05, -HD + 0.1), BRASS, { gloss: 1 }));
}

// ---------------------------------------------------------------- side walls: tall brass-framed panels
for (const side of [-1, 1]) {
  for (const z of [-2.4, 0, 2.4]) {
    const frame = new THREE.BoxGeometry(1.6, 1.9, 0.012).translate(0, 1.4, 0.05);
    const inner = new THREE.BoxGeometry(1.56, 1.86, 0.012).translate(0, 1.4, 0.058);
    const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    parts.push(bake(at(frame, side * HW, floorY, z, ry), BRASS, { gloss: 1 }));
    parts.push(bake(at(inner, side * HW, floorY, z, ry), C(0.035, 0.03, 0.028), { gloss: 0.6 }));
  }
}

// ---------------------------------------------------------------- pedestals: black stone columns with brass bands
const height = pedestal.top - floorY;
for (const p of pedestals) {
  const [x, z] = p.position;
  parts.push(
    bake(at(new THREE.CylinderGeometry(pedestal.radiusTop, pedestal.radiusBottom, height, 32, 12, true), x, floorY + height / 2, z), PLINTH, { gloss: 0.5 }),
  );
  // Black suede top, so the piece is the brightest thing on it.
  parts.push(bake(new THREE.CircleGeometry(pedestal.radiusTop, 32).rotateX(-Math.PI / 2).translate(x, pedestal.top, z), C(0.018, 0.016, 0.015)));
  // Brass bands at the top and the foot.
  parts.push(bake(at(new THREE.CylinderGeometry(pedestal.radiusTop + 0.006, pedestal.radiusTop + 0.006, 0.012, 32, 1, true), x, pedestal.top - 0.006, z), BRASS, { gloss: 1 }));
  parts.push(bake(at(new THREE.CylinderGeometry(pedestal.radiusBottom + 0.008, pedestal.radiusBottom + 0.008, 0.03, 32, 1, true), x, floorY + 0.015, z), BRASS, { gloss: 1 }));
  // A brass ring inlaid in the floor around the pedestal.
  parts.push(bake(new THREE.RingGeometry(0.58, 0.6, 64).rotateX(-Math.PI / 2).translate(x, floorY + 0.0015, z), BRASS, { gloss: 1 }));
}

// ---------------------------------------------------------------- decor: velvet banquettes, potted olive trees
for (const { position: [x, z], rotationY } of layout.decor.benches) {
  const { length, height, depth } = layout.decor.bench;
  const seat = new THREE.BoxGeometry(length, height - 0.08, depth, 14, 3, 4);
  parts.push(bake(at(seat, x, floorY + 0.08 + (height - 0.08) / 2, z, rotationY), VELVET));
  parts.push(bake(at(new THREE.BoxGeometry(length - 0.06, 0.08, depth - 0.06), x, floorY + 0.04, z, rotationY), BRASS, { gloss: 1 }));
  shadowCasters.push({ x, z, r: 0.25, strength: 0.5, falloff: 0.3 });
}
for (const [x, z] of layout.decor.plants) {
  const profile = [
    [0, 0],
    [0.15, 0],
    [0.2, 0.08],
    [0.23, 0.3],
    [0.2, 0.52],
    [0.17, 0.56],
    [0, 0.56],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  parts.push(bake(at(new THREE.LatheGeometry(profile, 20), x, floorY, z), CERAMIC, { gloss: 0.8 }));
  parts.push(bake(at(new THREE.CylinderGeometry(0.175, 0.175, 0.015, 20, 1, true), x, floorY + 0.55, z), BRASS, { gloss: 1 }));
  parts.push(bake(at(new THREE.CylinderGeometry(0.012, 0.02, 0.9, 6), x, floorY + 0.95, z), C(0.08, 0.06, 0.04)));
  for (const [dx, dy, dz, r] of [
    [0, 1.55, 0, 0.36],
    [0.16, 1.38, 0.1, 0.24],
    [-0.15, 1.42, -0.08, 0.26],
  ]) {
    parts.push(bake(at(new THREE.IcosahedronGeometry(r, 1), x + dx, floorY + dy, z + dz), FOLIAGE));
  }
  shadowCasters.push({ x, z, r: 0.2, strength: 0.5, falloff: 0.3 });
}

// Floor last, now that every shadow caster is known.
parts.push(...floorParts());

const geo = mergeGeometries(parts);

// ---------------------------------------------------------------- glTF
const doc = new Document();
const buffer = doc.createBuffer();
const attr = (name, type) =>
  doc.createAccessor().setType(type).setArray(new Float32Array(geo.getAttribute(name).array)).setBuffer(buffer);
const unlit = doc.createExtension(KHRMaterialsUnlit);
const material = doc.createMaterial("ShowroomBaked").setExtension("KHR_materials_unlit", unlit.createUnlit());
const prim = doc
  .createPrimitive()
  .setAttribute("POSITION", attr("position", "VEC3"))
  .setAttribute("NORMAL", attr("normal", "VEC3"))
  .setAttribute("COLOR_0", attr("color", "VEC3"))
  .setMaterial(material);
doc.createScene("Scene").addChild(doc.createNode("Showroom").setMesh(doc.createMesh("Showroom").addPrimitive(prim)));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "draco3d.decoder": await draco3d.createDecoderModule(),
});
await doc.transform(draco());
const glb = await io.writeBinary(doc);
await writeFile(OUT, glb);
console.log(`[generate-showroom] wrote ${OUT.pathname} (${(glb.byteLength / 1024).toFixed(1)} KB, ${geo.getAttribute("position").count} verts)`);
