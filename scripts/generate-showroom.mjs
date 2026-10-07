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
  ...[-4, -2.4, 2.4, 4].map((x) => spot(x, CEIL - 0.05, HD - 0.45, 2.2, 2.4, 0.96, 0.8, new THREE.Vector3(0, -1, 0.32))),
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
/** A lit room: its lights and its box (for ambient occlusion in the corners). */
const SALON = { lights: null, minX: -HW, maxX: HW, minZ: -HD, maxZ: HD, ceil: CEIL };
function bake(geo, albedo, { emissive = null, ao = null, gloss = 0, room: r = SALON } = {}) {
  const roomLights = r.lights ?? lights;
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
      for (const L of roomLights) {
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
      const wallDist = Math.min(p.x - r.minX, r.maxX - p.x, p.z - r.minZ, r.maxZ - p.z);
      const floorDist = p.y - floorY;
      let occ = 1 - 0.45 * Math.exp(-wallDist / 0.35) * Math.exp(-Math.max(floorDist, 0) / 0.5);
      occ *= 1 - 0.4 * Math.exp(-wallDist / 0.3) * Math.exp(-Math.max(r.ceil - p.y, 0) / 0.4);
      // Contact shadows on the floor.
      if (floorDist < 0.02) {
        for (const s of r.shadowCasters ?? shadowCasters) {
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
// Front: two segments either side of the gallery doorway, and a plaster lintel over it.
const gallery = layout.gallery;
const OPEN_HW = gallery.door.halfWidth + 0.06;
const OPEN_H = gallery.door.height + 0.06;
const segment = HW - OPEN_HW;
placeWall(segment, Math.PI, -(OPEN_HW + segment / 2), HD);
placeWall(segment, Math.PI, OPEN_HW + segment / 2, HD);
parts.push(bake(at(new THREE.PlaneGeometry(OPEN_HW * 2, room.height - OPEN_H, 6, 3).translate(0, OPEN_H + (room.height - OPEN_H) / 2, 0), 0, floorY, HD, Math.PI), PLASTER));
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
for (const x of [-4, -2.4, 2.4, 4]) downlight(x, HD - 0.45, 0.05);
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

// ---------------------------------------------------------------- entrance wall: doors, monograms, consoles
// Everything faces -z (into the salon): built in the XY plane, turned half a turn, placed against the wall.
const front = (geo, x, y, depth) => at(geo, x, y, HD - depth, Math.PI);
// The gallery doorway: a brass portal (jambs and head) through the wall's thickness; the glazed leaves are
// animated at runtime (components/canvas/Gallery.tsx).
{
  const t = gallery.wall;
  const zMid = HD + t / 2;
  for (const side of [-1, 1]) {
    parts.push(bake(at(new THREE.BoxGeometry(0.06, OPEN_H, t + 0.04), side * (gallery.door.halfWidth + 0.03), floorY + OPEN_H / 2, zMid), BRASS, { gloss: 1 }));
  }
  parts.push(bake(at(new THREE.BoxGeometry(OPEN_HW * 2, 0.06, t + 0.04), 0, floorY + OPEN_H - 0.03, zMid), BRASS, { gloss: 1 }));
  // Threshold: a brass strip across the floor.
  parts.push(bake(at(new THREE.BoxGeometry(gallery.door.halfWidth * 2, 0.006, t), 0, floorY + 0.003, zMid), BRASS, { gloss: 1 }));
}
// Monogram plaques either side: the house mark, a prism under an arch (light enters white, leaves golden), in brass on
// black lacquer, as in the icon.
function monogram(x) {
  const cy = 1.55;
  parts.push(bake(front(new THREE.BoxGeometry(0.86, 1.3, 0.02), x, floorY + cy, 0.03), BRASS, { gloss: 1 }));
  parts.push(bake(front(new THREE.BoxGeometry(0.82, 1.26, 0.02), x, floorY + cy, 0.04), C(0.02, 0.018, 0.017), { gloss: 0.8 }));
  const stroke = (a, b, w = 0.022) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const g = new THREE.BoxGeometry(Math.hypot(dx, dy) + w, w, 0.012).rotateZ(Math.atan2(dy, dx));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
    parts.push(bake(front(g, x, floorY + cy, 0.055), BRASS, { gloss: 1 }));
  };
  // Arch: two uprights and a half-circle.
  const r = 0.27;
  const top = 0.18;
  stroke([-r, -0.5], [-r, top]);
  stroke([r, -0.5], [r, top]);
  const arc = new THREE.TorusGeometry(r, 0.011, 8, 40, Math.PI).translate(0, top, 0);
  parts.push(bake(front(arc, x, floorY + cy, 0.055), BRASS, { gloss: 1 }));
  // The prism, the ray that enters it and the three that leave it.
  const P = [
    [-0.15, -0.27],
    [0.15, -0.27],
    [0, -0.01],
  ];
  stroke(P[0], P[1], 0.026);
  stroke(P[1], P[2], 0.026);
  stroke(P[2], P[0], 0.026);
  stroke([-0.25, -0.17], [-0.075, -0.14], 0.014);
  for (const y of [-0.06, -0.14, -0.22]) stroke([0.075, -0.14], [0.25, y], 0.012);
}
monogram(-1.75);
monogram(1.75);
// Consoles: black marble top on brass legs, with a ceramic vase and a branch of foliage.
{
  const { consoles, console: table } = layout.decor;
  for (const [x, z] of consoles) {
    const top = floorY + table.height;
    parts.push(bake(at(new THREE.BoxGeometry(table.length, 0.05, table.depth), x, top - 0.025, z), MARBLE, { gloss: 0.8 }));
    parts.push(bake(at(new THREE.BoxGeometry(table.length - 0.02, 0.012, table.depth - 0.02), x, top - 0.056, z), BRASS, { gloss: 1 }));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.CylinderGeometry(0.012, 0.012, table.height - 0.06, 8);
        parts.push(bake(at(leg, x + sx * (table.length / 2 - 0.06), floorY + (table.height - 0.06) / 2, z + sz * (table.depth / 2 - 0.05)), BRASS, { gloss: 1 }));
      }
    }
    const vase = [
      [0, 0],
      [0.06, 0],
      [0.1, 0.08],
      [0.08, 0.22],
      [0.04, 0.3],
      [0.05, 0.34],
      [0, 0.34],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    parts.push(bake(at(new THREE.LatheGeometry(vase, 18), x + 0.3, top, z), C(0.5, 0.45, 0.38), { gloss: 0.6 }));
    for (const [dx, dy, r] of [
      [0.28, 0.55, 0.13],
      [0.38, 0.5, 0.09],
      [0.22, 0.48, 0.08],
    ]) {
      parts.push(bake(at(new THREE.IcosahedronGeometry(r, 1), x + dx, top + dy, z - 0.02), FOLIAGE));
    }
    // A stack of house boxes.
    parts.push(bake(at(new THREE.BoxGeometry(0.3, 0.08, 0.22), x - 0.3, top + 0.04, z), C(0.03, 0.028, 0.026)));
    parts.push(bake(at(new THREE.BoxGeometry(0.22, 0.06, 0.16), x - 0.3, top + 0.11, z), C(0.6, 0.48, 0.3), { gloss: 0.4 }));
    shadowCasters.push({ x, z, r: 0.35, strength: 0.4, falloff: 0.3 });
  }
}

// ---------------------------------------------------------------- side walls: backlit vitrines around an artwork
// Built in a wall-local frame (x along the wall, y up from the floor, z out of the wall into the salon).
for (const side of [-1, 1]) {
  const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  const place = (geo, z) => at(geo, side * HW, floorY, z, ry);
  for (const z of [-2.4, 2.4]) {
    // Vitrine: brass frame, warm backlit back, three glass shelves with brass nosings, and a still life on each.
    parts.push(bake(place(new THREE.BoxGeometry(1.6, 1.9, 0.012).translate(0, 1.4, 0.05), z), BRASS, { gloss: 1 }));
    parts.push(
      bake(place(new THREE.PlaneGeometry(1.54, 1.84, 1, 12).translate(0, 1.4, 0.058), z), null, {
        emissive: (p) => {
          const t = Math.min(Math.max((p.y - floorY - 0.48) / 1.84, 0), 1);
          return C(0.06, 0.04, 0.022).lerp(C(0.4, 0.28, 0.15), Math.sin(t * Math.PI) ** 0.7);
        },
      }),
    );
    let seed = z * 7 + side * 3 + 11;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (const y of [0.85, 1.4, 1.95]) {
      parts.push(bake(place(new THREE.BoxGeometry(1.5, 0.012, 0.22).translate(0, y, 0.17), z), C(0.08, 0.075, 0.07), { gloss: 1 }));
      parts.push(bake(place(new THREE.BoxGeometry(1.5, 0.018, 0.008).translate(0, y, 0.28), z), BRASS, { gloss: 1 }));
      // Still life: perfume flacons, a box, a sphere; dark silhouettes against the glow.
      let x = -0.6 + rand() * 0.1;
      while (x < 0.6) {
        const kind = Math.floor(rand() * 3);
        const base = y + 0.006;
        if (kind === 0) {
          const h = 0.12 + rand() * 0.1;
          const r = 0.035 + rand() * 0.02;
          const flacon = [
            [0, 0],
            [r, 0],
            [r, h * 0.7],
            [r * 0.35, h * 0.8],
            [r * 0.35, h],
            [0, h],
          ].map(([a, b]) => new THREE.Vector2(a, b));
          parts.push(bake(place(new THREE.LatheGeometry(flacon, 12).translate(x, base, 0.16), z), C(0.04, 0.035, 0.03), { gloss: 1 }));
          parts.push(bake(place(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.025, 10).translate(x, base + h + 0.012, 0.16), z), BRASS, { gloss: 1 }));
          x += r * 2 + 0.08 + rand() * 0.1;
        } else if (kind === 1) {
          const w = 0.12 + rand() * 0.08;
          const h = 0.06 + rand() * 0.08;
          parts.push(bake(place(new THREE.BoxGeometry(w, h, 0.12).translate(x + w / 2, base + h / 2, 0.16), z), rand() > 0.5 ? C(0.03, 0.028, 0.026) : C(0.55, 0.42, 0.25), { gloss: 0.4 }));
          x += w + 0.1 + rand() * 0.1;
        } else {
          const r = 0.04 + rand() * 0.03;
          parts.push(bake(place(new THREE.IcosahedronGeometry(r, 2).translate(x + r, base + r, 0.16), z), BRASS, { gloss: 1 }));
          x += r * 2 + 0.1 + rand() * 0.1;
        }
      }
    }
  }
  // Center: a framed artwork, concentric brass arcs and a gilded disc on black lacquer.
  parts.push(bake(place(new THREE.BoxGeometry(1.6, 1.9, 0.012).translate(0, 1.4, 0.05), 0), BRASS, { gloss: 1 }));
  parts.push(bake(place(new THREE.BoxGeometry(1.54, 1.84, 0.012).translate(0, 1.4, 0.058), 0), C(0.018, 0.016, 0.015), { gloss: 0.8 }));
  parts.push(bake(place(new THREE.CircleGeometry(0.2, 40).translate(0.18, 1.62, 0.066), 0), BRASS, { gloss: 1 }));
  for (const [r, start, len] of [
    [0.34, 0.2, 2.2],
    [0.46, 2.6, 2.4],
    [0.58, 0.9, 1.6],
    [0.7, 3.8, 1.9],
  ]) {
    const arc = new THREE.TorusGeometry(r, 0.006, 6, 64, len).rotateZ(start).translate(-0.08, 1.3, 0.066);
    parts.push(bake(place(arc, 0), BRASS, { gloss: 1 }));
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

// ---------------------------------------------------------------- the gallery behind the entrance wall
// A contemporary art hall in the house's palette: waxed black concrete, charcoal plaster, a thin brass line at the
// plinth, brass ceiling tracks; a spot on every work and plinth, a wash under the kinetic rain, and at the back a
// theatre: a black stage with a brass nosing, oxblood velvet curtains along its sides, a lighting truss and the
// audience's bench. The stage is left dark: its light is the performance's (runtime).
{
  const g = gallery;
  const z0 = HD + g.wall;
  const z1 = z0 + g.depth;
  const gw = g.halfWidth;
  const gCeil = floorY + g.height;
  const CONCRETE = C(0.026, 0.025, 0.025);
  const CHARCOAL = C(0.06, 0.057, 0.054);
  const CURTAIN = C(0.11, 0.016, 0.022);
  const SPOT = C(1.0, 0.86, 0.7);
  const st = g.stage;
  const workPos = (w) => {
    const y = floorY + g.workCenterY;
    if (w.wall === "left") return { p: new THREE.Vector3(-gw, y, w.at), n: new THREE.Vector3(1, 0, 0) };
    if (w.wall === "right") return { p: new THREE.Vector3(gw, y, w.at), n: new THREE.Vector3(-1, 0, 0) };
    if (w.wall === "back") return { p: new THREE.Vector3(w.at, y, z1), n: new THREE.Vector3(0, 0, -1) };
    return { p: new THREE.Vector3(w.at, y, z0), n: new THREE.Vector3(0, 0, 1) };
  };
  const down = new THREE.Vector3(0, -1, 0);
  const galleryLights = [
    // A tight wall-washer on every work, from the ceiling 1.2 m out.
    ...g.works.map((w) => {
      const { p, n } = workPos(w);
      const from = p.clone().addScaledVector(n, 1.2).setY(gCeil - 0.05);
      return { pos: from, color: SPOT.clone().multiplyScalar(3.4), range: 3.2, dir: p.clone().sub(from).normalize(), inner: 0.97, outer: 0.88 };
    }),
    // A downlight on every plinth.
    // Soft-edged, so the pools blend into the concrete instead of drawing hard blotches.
    ...g.plinths.map(([x, z]) => ({ pos: new THREE.Vector3(x, gCeil - 0.05, z), color: SPOT.clone().multiplyScalar(2.6), range: 3.2, dir: down, inner: 0.96, outer: 0.84 })),
    // Under the rain: a soft gold wash.
    ...[-1.6, 0, 1.6].map((x) => ({ pos: new THREE.Vector3(x, gCeil - 0.05, g.rain.center[1]), color: C(1, 0.78, 0.45).multiplyScalar(0.8), range: 3.0, dir: down, inner: 0.96, outer: 0.82 })),
    // Low fill, and a faint glow on the audience.
    { pos: new THREE.Vector3(0, gCeil - 0.4, z0 + 3.5), color: C(0.08, 0.072, 0.065), range: 5 },
    { pos: new THREE.Vector3(0, gCeil - 0.4, g.audience[1]), color: C(0.06, 0.05, 0.045), range: 4 },
  ];
  const GALLERY_ROOM = {
    lights: galleryLights,
    minX: -gw,
    maxX: gw,
    minZ: z0,
    maxZ: z1,
    ceil: gCeil,
    shadowCasters: [
      ...g.plinths.map(([x, z]) => ({ x, z, r: 0.3, strength: 0.7, falloff: 0.25 })),
      { x: g.bench.position[0], z: g.bench.position[1], r: 0.6, strength: 0.5, falloff: 0.3 },
    ],
  };
  const gb = (geo, albedo, opts = {}) => parts.push(bake(geo, albedo, { ...opts, room: GALLERY_ROOM }));

  // Floor and ceiling.
  gb(new THREE.PlaneGeometry(gw * 2, g.depth, 90, 140).rotateX(-Math.PI / 2).translate(0, floorY, (z0 + z1) / 2), CONCRETE, { gloss: 0.5 });
  gb(new THREE.PlaneGeometry(gw * 2, g.depth, 8, 14).rotateX(Math.PI / 2).translate(0, gCeil, (z0 + z1) / 2), C(0.016, 0.016, 0.017));

  // Walls (facing into the room), each with a black plinth and a brass line. The theatre's sides are curtains.
  const wallPlane = (width, x, z, ry) => {
    gb(at(new THREE.PlaneGeometry(width, g.height, Math.ceil(width / 0.25), 16).translate(0, g.height / 2, 0), x, floorY, z, ry), CHARCOAL);
    gb(at(new THREE.BoxGeometry(width, 0.12, 0.02, Math.ceil(width / 0.25), 1, 1).translate(0, 0.06, 0.01), x, floorY, z, ry), PLINTH);
    gb(at(new THREE.BoxGeometry(width, 0.008, 0.024).translate(0, 0.124, 0.012), x, floorY, z, ry), BRASS, { gloss: 1 });
  };
  const hall = st.minZ - 1.2 - z0;
  wallPlane(hall, -gw, z0 + hall / 2, Math.PI / 2); // left, facing +x
  wallPlane(hall, gw, z0 + hall / 2, -Math.PI / 2); // right, facing -x
  wallPlane(gw * 2, 0, z1, Math.PI); // back, facing -z (behind the cyclorama)
  const side = gw - OPEN_HW;
  wallPlane(side, -(OPEN_HW + side / 2), z0, 0);
  wallPlane(side, OPEN_HW + side / 2, z0, 0);
  gb(new THREE.PlaneGeometry(OPEN_HW * 2, g.height - OPEN_H, 4, 3).translate(0, floorY + OPEN_H + (g.height - OPEN_H) / 2, z0), CHARCOAL);

  // Curtains: deep folds of oxblood velvet along the theatre's side walls, floor to ceiling.
  const curtainStart = z0 + hall;
  const curtainLength = z1 - curtainStart;
  for (const sx of [-1, 1]) {
    const c = new THREE.PlaneGeometry(curtainLength, g.height, Math.ceil(curtainLength / 0.05), 10);
    const pos = c.getAttribute("position");
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.05 + 0.06);
    gb(at(c.translate(0, g.height / 2, 0), sx * gw, floorY, curtainStart + curtainLength / 2, -sx * Math.PI / 2), CURTAIN, { gloss: 0.3 });
  }

  // Ceiling tracks with spot cans aimed at the works and plinths.
  for (const x of [-2.3, 2.3]) gb(new THREE.BoxGeometry(0.035, 0.03, hall - 0.6).translate(x, gCeil - 0.03, z0 + hall / 2), BRASS, { gloss: 1 });
  for (const L of galleryLights.filter((l) => l.dir)) {
    gb(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 16).translate(L.pos.x, gCeil - 0.08, L.pos.z), PLINTH, { gloss: 0.6 });
    parts.push(bake(new THREE.CircleGeometry(0.03, 16).rotateX(Math.PI / 2).translate(L.pos.x, gCeil - 0.141, L.pos.z), null, { emissive: C(2.6, 2.1, 1.5) }));
  }
  // The rain's ceiling plate: a dark panel in a brass frame, where the wires hang from.
  const [rx, rz] = g.rain.center;
  const rw = g.rain.cols * g.rain.spacing[0] + 0.3;
  const rd = g.rain.rows * g.rain.spacing[1] + 0.3;
  gb(new THREE.BoxGeometry(rw, 0.03, rd).translate(rx, gCeil - 0.015, rz), C(0.012, 0.012, 0.012));
  for (const sz of [-1, 1]) gb(new THREE.BoxGeometry(rw + 0.04, 0.04, 0.03).translate(rx, gCeil - 0.03, rz + (sz * rd) / 2), BRASS, { gloss: 1 });
  for (const sx of [-1, 1]) gb(new THREE.BoxGeometry(0.03, 0.04, rd).translate(rx + (sx * rw) / 2, gCeil - 0.03, rz), BRASS, { gloss: 1 });

  // Plinths: black stone blocks with a thin brass band at the top edge.
  for (const [x, z] of g.plinths) {
    gb(new THREE.BoxGeometry(0.5, g.plinthHeight, 0.5, 4, 8, 4).translate(x, floorY + g.plinthHeight / 2, z), PLINTH, { gloss: 0.4 });
    gb(new THREE.BoxGeometry(0.508, 0.012, 0.508).translate(x, floorY + g.plinthHeight + 0.006, z), BRASS, { gloss: 1 });
    gb(new THREE.BoxGeometry(0.48, 0.004, 0.48, 4, 1, 4).translate(x, floorY + g.plinthHeight + 0.014, z), PLINTH, { gloss: 0.6 });
  }
  // The audience's bench: black leather on a brass base, facing the stage.
  {
    const { position: [x, z], length, depth } = g.bench;
    gb(new THREE.BoxGeometry(length, 0.1, depth, 12, 1, 3).translate(x, floorY + 0.4, z), C(0.03, 0.026, 0.024), { gloss: 0.5 });
    gb(new THREE.BoxGeometry(length - 0.2, 0.34, depth - 0.12).translate(x, floorY + 0.17, z), PLINTH, { gloss: 0.4 });
    gb(new THREE.BoxGeometry(length - 0.18, 0.008, depth - 0.1).translate(x, floorY + 0.345, z), BRASS, { gloss: 1 });
  }
  // The stage: black, with a brass nosing and a step; its floor is lit only by the performance.
  {
    const w = st.maxX - st.minX;
    const d = st.maxZ - st.minZ;
    const cx = (st.minX + st.maxX) / 2;
    const cz = (st.minZ + st.maxZ) / 2;
    const STAGE_ROOM = { ...GALLERY_ROOM, lights: [{ pos: new THREE.Vector3(0, gCeil - 0.4, cz), color: C(0.05, 0.045, 0.04), range: 4 }] };
    parts.push(bake(new THREE.BoxGeometry(w, st.height, d, 20, 1, 12).translate(cx, floorY + st.height / 2, cz), C(0.018, 0.017, 0.017), { gloss: 0.7, room: STAGE_ROOM }));
    gb(new THREE.BoxGeometry(w + 0.02, 0.02, 0.03).translate(cx, floorY + st.height - 0.01, st.minZ - 0.005), BRASS, { gloss: 1 });
  }
  // The lighting truss: a brass box-truss across the front of the stage, on two thin hangers.
  {
    const ty = floorY + g.truss.y + 0.12;
    for (const dy of [0, 0.16]) for (const dz of [-0.08, 0.08]) gb(new THREE.CylinderGeometry(0.012, 0.012, 7.4, 8).rotateZ(Math.PI / 2).translate(0, ty + dy, g.truss.z + dz), BRASS, { gloss: 1 });
    for (let x = -3.6; x <= 3.6; x += 0.3) gb(new THREE.CylinderGeometry(0.005, 0.005, 0.23, 4).rotateX(Math.PI / 4).translate(x, ty + 0.08, g.truss.z), BRASS, { gloss: 1 });
    for (const x of [-3, 3]) gb(new THREE.CylinderGeometry(0.004, 0.004, gCeil - ty - 0.16, 4).translate(x, (gCeil + ty + 0.16) / 2, g.truss.z), PLINTH);
  }
}

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
