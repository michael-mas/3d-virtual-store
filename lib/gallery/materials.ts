import {
  abs,
  attribute,
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  hash,
  length,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalize,
  normalLocal,
  normalView,
  oneMinus,
  positionLocal,
  positionViewDirection,
  pow,
  select,
  sin,
  smoothstep,
  step,
  time,
  transformNormalToView,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { AdditiveBlending, DoubleSide, MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, type Material } from "three/webgpu";
import { art } from "./interactions";
import { stageUniforms as s } from "./stage";

/**
 * The gallery's works as TSL materials, no textures: each is drawn procedurally on its panel's UVs (0..1 across the
 * work) or on its sculpture's surface, and answers the visitor (lib/gallery/interactions.ts). The painted works are
 * unlit (their own spot is drawn in, and dims with the gallery's lights during the performance); the metal and stone
 * ones are physically lit by the environment, so they shimmer as the visitor walks past.
 */

const GOLD = vec3(1.0, 0.72, 0.32);

/** The wall-washer's pool of light on a painted work: bright upper middle, falling off toward the corners. */
function spotPool(u = uv()) {
  const d = length(vec2(u.x.sub(0.5).mul(1.1), u.y.sub(0.78).mul(0.95)));
  return mix(float(0.58), float(1.12), smoothstep(0.95, 0.05, d)).mul(s.house.mul(0.85).add(0.15));
}

/** Seconds since an interaction started (large and negative before it ever happened). */
const since = (start: Parameters<typeof s.clock.sub>[0]) => s.clock.sub(start);

/** Distance from p to the segment a–b. */
function segment(p: ReturnType<typeof vec2>, a: [number, number], b: [number, number]) {
  const A = vec2(...a);
  const ba = vec2(b[0] - a[0], b[1] - a[1]);
  const pa = p.sub(A);
  const h = clamp(dot(pa, ba).div(dot(ba, ba)), 0, 1);
  return length(pa.sub(ba.mul(h)));
}

/**
 * Champ d'or: a field of 30 × 40 hand-laid gold leaf squares, each tilted a little, with darker overlapping seams;
 * a touch sends a wave through the leaves, lifting and lighting them as it passes.
 */
function champDOr(): Material {
  const m = new MeshPhysicalNodeMaterial({ name: "art-champ-d-or", metalness: 1, roughness: 0.3 });
  const u = uv();
  const grid = u.mul(vec2(30, 40));
  const cell = floor(grid);
  const f = fract(grid);
  const seed = hash(cell.x.add(cell.y.mul(131)));
  const seed2 = hash(cell.x.mul(7).add(cell.y.mul(977)).add(13));
  const edge = min(min(f.x, oneMinus(f.x)), min(f.y, oneMinus(f.y)));
  const seam = smoothstep(0.0, 0.06, edge);
  const crinkle = mx_noise_float(u.mul(vec2(260, 330)));
  // The wave: a ring leaving the touched point, tile by tile.
  const center = cell.add(0.5).div(vec2(30, 40));
  const age = since(art.goldWave.z);
  const d = length(center.sub(art.goldWave.xy).mul(vec2(1.4, 1.8)));
  const ring = exp(d.sub(age.mul(0.9)).pow(2).mul(-90)).mul(exp(age.mul(-0.5))).mul(step(0, age));
  const gold = mix(vec3(0.94, 0.7, 0.34), vec3(1.0, 0.82, 0.48), seed).mul(mix(0.82, 1.04, seed2));
  m.colorNode = gold.mul(mix(0.55, 1, seam)).mul(s.house.mul(0.7).add(0.3));
  m.roughnessNode = mix(0.16, 0.38, seed2).add(crinkle.mul(0.06)).add(oneMinus(seam).mul(0.3));
  // Each leaf faces a slightly different way, so the field flickers square by square as the light moves.
  const tilt = vec2(seed.sub(0.5), seed2.sub(0.5)).mul(ring.mul(1.6).add(0.22)).add(vec2(crinkle.mul(0.04), crinkle.mul(0.03)));
  m.normalNode = transformNormalToView(normalize(vec3(tilt.x, tilt.y, 1)));
  m.emissiveNode = GOLD.mul(ring).mul(seed.mul(0.6).add(0.5)).mul(0.9);
  return m;
}

/** Marée: a seascape in deep blues on an eleven-second swell; a touch drops ripples that spread over the sea. */
function maree(): Material {
  const m = new MeshBasicNodeMaterial({ name: "art-maree" });
  const u = uv();
  const horizon = float(0.52);
  const swell = sin(time.mul((Math.PI * 2) / 11)).mul(0.5).add(0.5);
  const sky = mix(vec3(0.16, 0.2, 0.28), vec3(0.02, 0.03, 0.07), smoothstep(horizon, 1, u.y));
  const ripple = mx_fractal_noise_float(vec3(u.x.mul(3), u.y.mul(46).sub(time.mul(0.12)), time.mul(0.05)), 4, 2, 0.5);
  const glint = smoothstep(0.25, 0.75, ripple.mul(0.5).add(0.5)).mul(smoothstep(0.0, horizon, u.y)).mul(swell.mul(0.5).add(0.5));
  // Touched ripples: rings of light spreading from each touch, fading.
  const rings = art.ripples
    .map((r) => {
      const age = since(r.z);
      const d = length(u.sub(r.xy).mul(vec2(2.0, 1.3)));
      const front = d.sub(age.mul(0.22));
      return sin(front.mul(90)).mul(exp(abs(front).mul(-14))).mul(exp(age.mul(-0.45))).mul(step(0, age));
    })
    .reduce((a, b) => a.add(b));
  const sea = mix(vec3(0.004, 0.008, 0.018), vec3(0.05, 0.08, 0.13), u.y.div(horizon))
    .add(vec3(0.18, 0.22, 0.28).mul(glint).mul(0.35))
    .add(vec3(0.35, 0.45, 0.6).mul(max(rings, 0)).mul(0.6));
  const blend = smoothstep(horizon.sub(0.006), horizon.add(0.012), u.y);
  const haze = exp(abs(u.y.sub(horizon)).mul(-60)).mul(0.12).mul(swell.mul(0.3).add(0.7));
  m.colorNode = mix(sea, sky.add(vec3(0.2, 0.25, 0.32).mul(max(rings, 0)).mul(0.25)), blend).add(haze).mul(spotPool(u));
  return m;
}

/** Constellation: brass points on black lacquer, a few flickering; a touch sends three shooting stars across. */
function constellation(): Material {
  const m = new MeshBasicNodeMaterial({ name: "art-constellation" });
  const u = uv();
  const grid = u.mul(34);
  const cell = floor(grid);
  const seed = hash(cell.x.add(cell.y.mul(311)).add(7));
  const seed2 = hash(cell.x.mul(13).add(cell.y.mul(71)).add(3));
  const seed3 = hash(cell.x.mul(29).add(cell.y.mul(53)).add(11));
  const star = vec2(seed2, seed3).mul(0.7).add(0.15);
  const d = length(fract(grid).sub(star));
  const present = step(0.62, seed);
  const size = mix(0.035, 0.11, pow(seed3, 3));
  const age = since(art.meteors);
  const awake = exp(age.mul(-0.8)).mul(step(0, age));
  const flicker = mix(float(1), sin(time.mul(mix(0.6, 2.2, seed2)).add(seed.mul(40))).mul(0.5).add(0.5), max(step(0.93, seed2), awake));
  const point = smoothstep(size, size.mul(0.3), d).mul(present).mul(flicker).mul(awake.mul(1.5).add(1));
  const dir = vec2(0.8, -0.6);
  const meteors = [0, 1, 2]
    .map((k) => {
      const a = age.sub(k * 0.45);
      const head = vec2(0.05 + k * 0.22, 0.98 - k * 0.12).add(dir.mul(a.mul(0.95)));
      const rel = u.sub(head);
      const along = dot(rel, dir);
      const perp = length(rel.sub(dir.mul(along)));
      const tail = smoothstep(-0.3, 0, along).mul(step(along, 0.004));
      const live = step(0, a).mul(step(a, 1.6));
      return smoothstep(0.004, 0, perp).mul(tail).mul(live);
    })
    .reduce((x, y) => x.add(y));
  const lacquer = vec3(0.012, 0.011, 0.01).add(vec3(0.02, 0.018, 0.015).mul(smoothstep(0.9, 0.1, length(u.sub(vec2(0.5, 0.75))))));
  const brass = vec3(1.0, 0.78, 0.42).mul(1.6);
  m.colorNode = mix(lacquer, brass, clamp(point, 0, 1)).mul(spotPool(u)).add(vec3(1, 0.9, 0.7).mul(meteors).mul(2.2));
  return m;
}

/**
 * Fragment: an ivory canvas, a single vertical cut (after the spatialist slashes); a touch opens the cut, and a
 * golden light pours out of the space behind it.
 */
function fragment(): Material {
  const m = new MeshBasicNodeMaterial({ name: "art-fragment" });
  const u = uv();
  const open = art.fragmentOpen;
  const along = u.y.sub(0.5).div(0.36);
  const centerX = float(0.53).add(u.y.sub(0.5).mul(0.05));
  const halfWidth = max(oneMinus(along.mul(along)), 0).mul(open.mul(4.5).add(1).mul(0.017));
  const dx = abs(u.x.sub(centerX));
  // (Past the cut's ends its width is zero: nothing is inside.)
  const inside = smoothstep(halfWidth, halfWidth.mul(0.6), dx).mul(step(abs(along), 1));
  const lip = smoothstep(halfWidth.add(0.05), halfWidth, dx).mul(step(abs(along), 1));
  const weave = mx_noise_float(u.mul(vec2(900, 1100))).mul(0.012);
  const canvas = vec3(0.86, 0.83, 0.76).add(weave).mul(oneMinus(lip.mul(0.45)));
  // Behind the cut: darkness, or light once it opens; the light spills onto the canvas around it.
  const glow = GOLD.mul(open).mul(smoothstep(1, 0, abs(along)).mul(2.6).add(0.4));
  const behind = mix(vec3(0.004, 0.003, 0.003), glow, open);
  const spill = GOLD.mul(open).mul(exp(dx.sub(halfWidth).max(0).mul(-22))).mul(step(abs(along), 1.1)).mul(0.5);
  m.colorNode = mix(canvas.mul(spotPool(u)).add(spill), behind, inside);
  return m;
}

/**
 * Lumière lente, the theatre's cyclorama: a field of light drifting dawn amber → rose → night blue over four
 * minutes; during the performance it takes the show's color.
 */
function lumiereLente(): { field: Material; halo: Material } {
  const phase = time.mul((Math.PI * 2) / 240);
  const amber = vec3(1.0, 0.42, 0.1);
  const rose = vec3(0.85, 0.16, 0.34);
  const night = vec3(0.08, 0.14, 0.7);
  const a = cos(phase).mul(0.5).add(0.5);
  const b = sin(phase).mul(0.5).add(0.5);
  const drift = mix(mix(night, amber, a), rose, b.mul(oneMinus(a)).mul(1.4).min(1)).mul(0.75);
  const tint = mix(drift, s.cycloColor.mul(s.cycloLevel).mul(1.3), s.cycloShow);
  const breath = sin(time.mul(0.45)).mul(0.06).add(1);

  const field = new MeshBasicNodeMaterial({ name: "art-lumiere-lente" });
  const u = uv();
  const edge = min(min(u.x, oneMinus(u.x)), min(u.y, oneMinus(u.y)));
  const frame = smoothstep(0.0, 0.12, edge);
  const center = length(vec2(u.x.sub(0.5).mul(1.3), u.y.sub(0.5)));
  const glow = smoothstep(0.75, 0.0, center);
  const heart = pow(glow, 3);
  field.colorNode = tint
    .mul(mix(0.12, 0.85, frame.mul(glow.mul(0.7).add(0.3))))
    .add(mix(tint, vec3(1, 0.93, 0.85).mul(tint.length().min(1)), 0.5).mul(heart).mul(0.55))
    .mul(breath);

  const halo = new MeshBasicNodeMaterial({ name: "art-lumiere-halo", transparent: true, depthWrite: false, blending: AdditiveBlending });
  const h = uv().sub(0.5).mul(vec2(1.5, 1.3));
  const fall = clamp(oneMinus(length(h).mul(1.6)), 0, 1);
  halo.colorNode = tint.mul(pow(fall, 2.2)).mul(0.16).mul(breath);
  return { field, halo };
}

/**
 * Miroir noir: polished black obsidian. As the visitor comes near, the house's emblem (the arch and the M) surfaces
 * in gold from its depth; a touch makes it flare.
 */
function miroirNoir(): Material {
  // Drawn rather than lit: a deep black with a faint sheen toward grazing angles (a lit mirror would show the studio
  // environment's light panels as a white glare in this dark room).
  const m = new MeshBasicNodeMaterial({ name: "art-miroir-noir" });
  const facing = abs(dot(normalView, positionViewDirection));
  const aspect = 1.2 / 1.6;
  const u = uv();
  const p = vec2(u.x.mul(aspect), u.y);
  const sx = (x: number) => x * aspect;
  const c = vec2(sx(0.5), 0.6);
  const R = sx(0.26);
  const sides = select(p.y.lessThan(0.6), min(abs(p.x.sub(sx(0.24))), abs(p.x.sub(sx(0.76)))).add(max(float(0.14).sub(p.y), 0)), float(1));
  const top = select(p.y.greaterThanEqual(0.6), abs(length(p.sub(c)).sub(R)), float(1));
  const arch = min(sides, top);
  const M = min(
    min(segment(p, [sx(0.37), 0.2], [sx(0.37), 0.5]), segment(p, [sx(0.37), 0.5], [sx(0.5), 0.33])),
    min(segment(p, [sx(0.5), 0.33], [sx(0.63), 0.5]), segment(p, [sx(0.63), 0.5], [sx(0.63), 0.2])),
  );
  const d = min(arch, M);
  const line = smoothstep(0.006, 0.0015, d).mul(0.8).add(exp(d.mul(-90)).mul(0.12));
  const flare = exp(since(art.mirrorFlare).mul(-1.4)).mul(step(0, since(art.mirrorFlare))).mul(2.5);
  const sheen = pow(oneMinus(facing), 3).mul(0.08).add(smoothstep(0.2, 1, u.y).mul(0.025));
  m.colorNode = vec3(0.008, 0.008, 0.009).add(vec3(sheen)).mul(s.house.mul(0.7).add(0.3)).add(GOLD.mul(line).mul(art.mirrorNear.mul(0.9).add(flare)));
  return m;
}

/** Carrara: white with soft grey veins (folded noise), lit. */
function marble(): Material {
  const m = new MeshPhysicalNodeMaterial({ name: "art-marble", roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const p = positionLocal.mul(9);
  const warp = mx_fractal_noise_float(p, 4, 2, 0.5);
  const vein = abs(sin(p.x.add(p.y.mul(0.6)).add(warp.mul(5))));
  const veins = pow(oneMinus(vein), 9).mul(0.55).add(pow(oneMinus(vein), 40).mul(0.3));
  m.colorNode = mix(vec3(0.93, 0.92, 0.9), vec3(0.42, 0.42, 0.44), veins).mul(warp.mul(0.04).add(1));
  return m;
}

/** Basalt: very dark, finely grained stone. */
function basalt(): Material {
  const m = new MeshPhysicalNodeMaterial({ name: "art-basalt", roughness: 0.55 });
  const grain = mx_noise_float(positionLocal.mul(220)).mul(0.5).add(0.5);
  m.colorNode = vec3(0.03, 0.03, 0.032).mul(mix(0.7, 1.3, grain));
  m.roughnessNode = mix(0.4, 0.75, grain);
  return m;
}

/** The knot's steel, morphing between the trefoil (its geometry) and a cinquefoil (`positionB`/`normalB`). */
function knotSteel(): Material {
  const m = new MeshPhysicalNodeMaterial({ name: "art-knot", color: "#f2f2f4", metalness: 1, roughness: 0.03 });
  const k = smoothstep(0, 1, art.knotMorph);
  m.positionNode = mix(positionLocal, attribute("positionB", "vec3"), k);
  m.normalNode = transformNormalToView(normalize(mix(normalLocal, attribute("normalB", "vec3"), k)));
  return m;
}

export type WallWorkId = "champ-d-or" | "maree" | "constellation" | "fragment" | "miroir-noir";

export type GalleryMaterials = {
  works: Record<WallWorkId, Material>;
  cyclorama: Material;
  halo: Material;
  frame: Material;
  brass: Material;
  polishedBrass: Material;
  steel: Material;
  knot: Material;
  marble: Material;
  basalt: Material;
  kintsugi: Material;
  glass: Material;
  doorBrass: Material;
  stage: Material;
};

export function createGalleryMaterials(): GalleryMaterials {
  const light = lumiereLente();
  // The gold seam glows a little, as if lit from inside the stone; a touch sends light flowing down the crack.
  const kintsugi = new MeshPhysicalNodeMaterial({ name: "art-kintsugi", color: "#e0b55c", metalness: 1, roughness: 0.2 });
  const flowAge = since(art.goldFlow);
  const flow = exp(uv().x.sub(flowAge.mul(0.45)).pow(2).mul(-160)).mul(step(0, flowAge)).mul(exp(flowAge.mul(-0.25)));
  kintsugi.emissiveNode = vec3(0.9, 0.6, 0.22).mul(sin(time.mul(0.7)).mul(0.15).add(0.45)).add(GOLD.mul(flow).mul(4));
  // The stage's front edge: a thin line of light in the show's color.
  const stage = new MeshBasicNodeMaterial({ name: "stage-edge" });
  stage.colorNode = s.rimColor.mul(s.rimLevel.mul(1.6).add(0.05));
  return {
    works: {
      "champ-d-or": champDOr(),
      maree: maree(),
      constellation: constellation(),
      fragment: fragment(),
      "miroir-noir": miroirNoir(),
    },
    cyclorama: light.field,
    halo: light.halo,
    frame: new MeshPhysicalNodeMaterial({ name: "art-frame", color: "#0b0a09", roughness: 0.5 }),
    brass: new MeshPhysicalNodeMaterial({ name: "art-brass", color: "#c8a96a", metalness: 1, roughness: 0.32 }),
    // Double-sided: the Möbius band has a single side.
    polishedBrass: new MeshPhysicalNodeMaterial({ name: "art-brass-polished", color: "#d8b46e", metalness: 1, roughness: 0.08, side: DoubleSide }),
    steel: new MeshPhysicalNodeMaterial({ name: "art-steel", color: "#f2f2f4", metalness: 1, roughness: 0.03 }),
    knot: knotSteel(),
    marble: marble(),
    basalt: basalt(),
    kintsugi,
    // Door glazing: a smoky, barely tinted pane (not transmissive: see lib/layers.ts), reflections from the clearcoat.
    glass: new MeshPhysicalNodeMaterial({
      name: "gallery-door-glass",
      color: "#1a1714",
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      depthWrite: false,
    }),
    doorBrass: new MeshPhysicalNodeMaterial({ name: "gallery-door-brass", color: "#c8a96a", metalness: 1, roughness: 0.22 }),
    stage,
  };
}
