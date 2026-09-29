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

// ---------------------------------------------------------------- lights (baked)
// Values are pre-tone-mapping (ACES at runtime); kept moderate so walls do not clip to white.
const AMBIENT = new THREE.Color(0.07, 0.075, 0.09);
const lights = [
  // Accent spot-ish light above each pedestal.
  ...pedestals.map((p) => ({
    pos: new THREE.Vector3(p.position[0], CEIL - 0.2, p.position[1]),
    color: new THREE.Color(...p.accent).multiplyScalar(1.1),
    range: 1.6,
  })),
  // Broad fill lights.
  { pos: new THREE.Vector3(-2.5, CEIL - 0.1, 2.2), color: new THREE.Color(0.42, 0.4, 0.37), range: 3 },
  { pos: new THREE.Vector3(2.5, CEIL - 0.1, 2.2), color: new THREE.Color(0.42, 0.4, 0.37), range: 3 },
  { pos: new THREE.Vector3(0, CEIL - 0.1, -3.2), color: new THREE.Color(0.36, 0.36, 0.4), range: 3 },
];

// Circles on the floor that receive contact shadows (pedestals, benches, plants).
const shadowCasters = [
  ...pedestals.map((p) => ({ x: p.position[0], z: p.position[1], r: pedestal.radiusBottom, strength: 0.65, falloff: 0.35 })),
];

const _n = new THREE.Vector3();
const _l = new THREE.Vector3();
function bake(geo, albedo, { emissive = null, ao = null } = {}) {
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
      c = emissive.clone();
    } else {
      c = AMBIENT.clone();
      for (const L of lights) {
        _l.copy(L.pos).sub(p);
        const d = _l.length();
        const lambert = Math.max(0, _n.dot(_l.normalize()));
        const atten = 1 / (1 + (d / L.range) ** 2);
        c.add(L.color.clone().multiplyScalar(lambert * atten));
      }
      c.multiply(albedo);
      // Ambient occlusion: creases where walls meet the floor.
      const wallDist = Math.min(HW - Math.abs(p.x), HD - Math.abs(p.z));
      const floorDist = p.y - floorY;
      let occ = 1 - 0.35 * Math.exp(-wallDist / 0.4) * Math.exp(-Math.max(floorDist, 0) / 0.6);
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

// ---------------------------------------------------------------- room shell (walls face inward)
const floor = new THREE.PlaneGeometry(HW * 2, HD * 2, 48, 44).rotateX(-Math.PI / 2).translate(0, floorY, 0);
parts.push(bake(floor, new THREE.Color(0.34, 0.31, 0.29)));

const ceiling = new THREE.PlaneGeometry(HW * 2, HD * 2, 10, 9).rotateX(Math.PI / 2).translate(0, CEIL, 0);
parts.push(bake(ceiling, new THREE.Color(0.18, 0.18, 0.2)));

const wallColor = new THREE.Color(0.5, 0.47, 0.45);
const wall = (w, ry, x, z) => at(new THREE.PlaneGeometry(w, room.height, 30, 10).translate(0, room.height / 2, 0), x, floorY, z, ry);
parts.push(bake(wall(HW * 2, 0, 0, -HD), wallColor)); // back
parts.push(bake(wall(HW * 2, Math.PI, 0, HD), wallColor)); // front (culled from outside)
parts.push(bake(wall(HD * 2, Math.PI / 2, -HW, 0), wallColor)); // left
parts.push(bake(wall(HD * 2, -Math.PI / 2, HW, 0), wallColor)); // right

// Ceiling light strips (emissive, unaffected by the bake).
for (const x of [-2.5, 0, 2.5]) {
  parts.push(bake(at(new THREE.BoxGeometry(0.12, 0.04, 5.5), x, CEIL - 0.03, 0), null, { emissive: new THREE.Color(1.4, 1.35, 1.25) }));
}

// ---------------------------------------------------------------- pedestals + platforms + accent panels
const height = pedestal.top - floorY;
for (const p of pedestals) {
  const [x, z] = p.position;
  const accent = new THREE.Color(...p.accent);
  parts.push(
    bake(at(new THREE.CylinderGeometry(pedestal.radiusTop, pedestal.radiusBottom, height, 10), x, floorY + height / 2, z), new THREE.Color(0.78, 0.75, 0.71)),
  );
  parts.push(bake(at(new THREE.CylinderGeometry(0.62, 0.66, 0.04, 16), x, floorY + 0.02, z), accent.clone().multiplyScalar(0.28)));
  // Lit panel on the wall behind (or the back wall for the centre pedestal).
  parts.push(bake(at(new THREE.BoxGeometry(1.1, 1.8, 0.05), x, floorY + 1.6, -HD + 0.03), null, { emissive: accent.clone().multiplyScalar(0.35) }));
}

// ---------------------------------------------------------------- decor: benches, plants
for (const { position: [x, z], rotationY } of layout.decor.benches) {
  const { length, height, depth } = layout.decor.bench;
  parts.push(bake(at(new THREE.BoxGeometry(length, height, depth), x, floorY + height / 2, z, rotationY), new THREE.Color(0.45, 0.33, 0.24)));
  shadowCasters.push({ x, z, r: 0.25, strength: 0.4, falloff: 0.3 });
}
for (const [x, z] of layout.decor.plants) {
  parts.push(bake(at(new THREE.CylinderGeometry(0.22, 0.17, 0.45, 8), x, floorY + 0.225, z), new THREE.Color(0.6, 0.35, 0.25)));
  parts.push(bake(at(new THREE.IcosahedronGeometry(0.42, 0), x, floorY + 0.85, z), new THREE.Color(0.2, 0.42, 0.22)));
  shadowCasters.push({ x, z, r: 0.2, strength: 0.45, falloff: 0.3 });
}

// Re-bake the floor now that decor shadow casters are known.
parts[0] = bake(new THREE.PlaneGeometry(HW * 2, HD * 2, 48, 44).rotateX(-Math.PI / 2).translate(0, floorY, 0), new THREE.Color(0.34, 0.31, 0.29));

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
