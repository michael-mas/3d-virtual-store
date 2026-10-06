import {
  abs,
  clamp,
  cos,
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
  oneMinus,
  positionLocal,
  pow,
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
import type { ArtworkId } from "./artworks";

/**
 * The gallery's works as TSL materials, no textures: each is drawn procedurally on its panel's UVs (0..1 across the
 * work) or on its sculpture's surface. The painted works are unlit (their own spot is drawn in: brighter at the top,
 * where the gallery's wall-washer hits), the metal and stone ones are physically lit by the salon's environment, so
 * they shimmer as the visitor walks past.
 */

/** The wall-washer's pool of light on a painted work: bright upper middle, falling off toward the corners. */
function spotPool(u = uv()) {
  const d = length(vec2(u.x.sub(0.5).mul(1.1), u.y.sub(0.78).mul(0.95)));
  return mix(float(0.58), float(1.12), smoothstep(0.95, 0.05, d));
}

/** Champ d'or: a field of 30 × 40 hand-laid gold leaf squares, each tilted a little, with darker overlapping seams. */
function champDOr(): Material {
  const m = new MeshPhysicalNodeMaterial({ name: "art-champ-d-or", metalness: 1, roughness: 0.3 });
  const grid = uv().mul(vec2(30, 40));
  const cell = floor(grid);
  const f = fract(grid);
  const seed = hash(cell.x.add(cell.y.mul(131)));
  const seed2 = hash(cell.x.mul(7).add(cell.y.mul(977)).add(13));
  const edge = min(min(f.x, oneMinus(f.x)), min(f.y, oneMinus(f.y)));
  const seam = smoothstep(0.0, 0.06, edge);
  const crinkle = mx_noise_float(uv().mul(vec2(260, 330)));
  const gold = mix(vec3(0.94, 0.7, 0.34), vec3(1.0, 0.82, 0.48), seed).mul(mix(0.82, 1.04, seed2));
  m.colorNode = gold.mul(mix(0.55, 1, seam));
  m.roughnessNode = mix(0.16, 0.38, seed2).add(crinkle.mul(0.06)).add(oneMinus(seam).mul(0.3));
  // Each leaf faces a slightly different way, so the field flickers square by square as the light moves.
  const tilt = vec2(seed.sub(0.5), seed2.sub(0.5)).mul(0.22).add(vec2(crinkle.mul(0.04), crinkle.mul(0.03)));
  m.normalNode = transformNormalToView(normalize(vec3(tilt.x, tilt.y, 1)));
  return m;
}

/** Marée: a seascape in deep blues, a soft horizon, the sea's surface breathing on an eleven-second swell. */
function maree(): Material {
  const m = new MeshBasicNodeMaterial({ name: "art-maree" });
  const u = uv();
  const horizon = float(0.52);
  const swell = sin(time.mul((Math.PI * 2) / 11)).mul(0.5).add(0.5);
  // Sky: night blue to a pale band at the horizon.
  const sky = mix(vec3(0.16, 0.2, 0.28), vec3(0.02, 0.03, 0.07), smoothstep(horizon, 1, u.y));
  // Sea: dark, with long, slow ripples catching the light near the horizon.
  const ripple = mx_fractal_noise_float(vec3(u.x.mul(3), u.y.mul(46).sub(time.mul(0.12)), time.mul(0.05)), 4, 2, 0.5);
  const glint = smoothstep(0.25, 0.75, ripple.mul(0.5).add(0.5)).mul(smoothstep(0.0, horizon, u.y)).mul(swell.mul(0.5).add(0.5));
  const sea = mix(vec3(0.004, 0.008, 0.018), vec3(0.05, 0.08, 0.13), u.y.div(horizon)).add(vec3(0.18, 0.22, 0.28).mul(glint).mul(0.35));
  const blend = smoothstep(horizon.sub(0.006), horizon.add(0.012), u.y);
  const haze = exp(abs(u.y.sub(horizon)).mul(-60)).mul(0.12).mul(swell.mul(0.3).add(0.7));
  m.colorNode = mix(sea, sky, blend).add(haze).mul(spotPool(u));
  return m;
}

/** Constellation: brass points on black lacquer, a few flickering, on a jittered grid. */
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
  const flicker = mix(float(1), sin(time.mul(mix(0.6, 2.2, seed2)).add(seed.mul(40))).mul(0.5).add(0.5), step(0.93, seed2));
  const point = smoothstep(size, size.mul(0.3), d).mul(present).mul(flicker);
  const lacquer = vec3(0.012, 0.011, 0.01).add(vec3(0.02, 0.018, 0.015).mul(smoothstep(0.9, 0.1, length(u.sub(vec2(0.5, 0.75))))));
  const brass = vec3(1.0, 0.78, 0.42).mul(1.6);
  m.colorNode = mix(lacquer, brass, point).mul(spotPool(u));
  return m;
}

/**
 * Fragment: an ivory canvas, a single vertical cut (lens-shaped, dark inside, its lips curling in with soft
 * shading), after the spatialist slashes.
 */
function fragment(): Material {
  const m = new MeshBasicNodeMaterial({ name: "art-fragment" });
  const u = uv();
  // The cut runs a little off-vertical, widest at its middle.
  const along = u.y.sub(0.5).div(0.36);
  const centerX = float(0.53).add(u.y.sub(0.5).mul(0.05));
  const halfWidth = max(oneMinus(along.mul(along)), 0).mul(0.017);
  const dx = abs(u.x.sub(centerX));
  const inside = smoothstep(halfWidth, halfWidth.mul(0.6), dx);
  // The canvas sinks toward the cut: shading on the lips.
  const lip = smoothstep(halfWidth.add(0.05), halfWidth, dx).mul(step(abs(along), 1));
  const weave = mx_noise_float(u.mul(vec2(900, 1100))).mul(0.012);
  const canvas = vec3(0.86, 0.83, 0.76).add(weave).mul(oneMinus(lip.mul(0.45)));
  const depth = vec3(0.004, 0.003, 0.003);
  m.colorNode = mix(canvas, depth, inside).mul(spotPool(u));
  return m;
}

/**
 * Lumière lente: a field of light whose color drifts dawn amber → rose → night blue → amber over four minutes,
 * brighter at its center (it glows through the bloom), with a slow breathing.
 */
function lumiereLente(): { field: Material; halo: Material } {
  const phase = time.mul((Math.PI * 2) / 240);
  const amber = vec3(1.0, 0.42, 0.1);
  const rose = vec3(0.85, 0.16, 0.34);
  const night = vec3(0.08, 0.14, 0.7);
  const a = cos(phase).mul(0.5).add(0.5);
  const b = sin(phase).mul(0.5).add(0.5);
  const tint = mix(mix(night, amber, a), rose, b.mul(oneMinus(a)).mul(1.4).min(1));
  const breath = sin(time.mul(0.45)).mul(0.06).add(1);

  // A diffuse field (no visible surface, as in a Ganzfeld): deep at the edges, glowing toward a center set a
  // little high, with a paler heart that crosses the bloom threshold.
  const field = new MeshBasicNodeMaterial({ name: "art-lumiere-lente" });
  const u = uv();
  const edge = min(min(u.x, oneMinus(u.x)), min(u.y, oneMinus(u.y)));
  const frame = smoothstep(0.0, 0.18, edge);
  const center = length(vec2(u.x.sub(0.5).mul(1.3), u.y.sub(0.56)));
  const glow = smoothstep(0.62, 0.0, center);
  const heart = pow(glow, 3);
  field.colorNode = tint
    .mul(mix(0.12, 0.85, frame.mul(glow.mul(0.7).add(0.3))))
    .add(mix(tint, vec3(1, 0.93, 0.85), 0.5).mul(heart).mul(0.55))
    .mul(breath);

  // Its light spilling onto the wall around it (additive, fading out).
  const halo = new MeshBasicNodeMaterial({ name: "art-lumiere-halo", transparent: true, depthWrite: false, blending: AdditiveBlending });
  const h = uv().sub(0.5).mul(vec2(1.5, 1.3));
  const fall = clamp(oneMinus(length(h).mul(1.6)), 0, 1);
  halo.colorNode = tint.mul(pow(fall, 2.2)).mul(0.16).mul(breath);
  return { field, halo };
}

/** Miroir noir: polished black obsidian, a deep mirror. */
function miroirNoir(): Material {
  return new MeshPhysicalNodeMaterial({ name: "art-miroir-noir", color: "#050505", metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 });
}

export type GalleryMaterials = {
  works: Record<Exclude<ArtworkId, "ruban" | "equilibre" | "noeud" | "monolithe">, Material>;
  halo: Material;
  /** Thin shadow-gap frames (black) and the brass ones. */
  frame: Material;
  brass: Material;
  polishedBrass: Material;
  steel: Material;
  marble: Material;
  basalt: Material;
  kintsugi: Material;
  glass: Material;
  doorBrass: Material;
};

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

export function createGalleryMaterials(): GalleryMaterials {
  const light = lumiereLente();
  // The gold seam glows a little, as if lit from inside the stone.
  const kintsugi = new MeshPhysicalNodeMaterial({ name: "art-kintsugi", color: "#e0b55c", metalness: 1, roughness: 0.2 });
  kintsugi.emissiveNode = vec3(0.9, 0.6, 0.22).mul(sin(time.mul(0.7)).mul(0.15).add(0.45));
  return {
    works: {
      "champ-d-or": champDOr(),
      maree: maree(),
      constellation: constellation(),
      fragment: fragment(),
      "lumiere-lente": light.field,
      "miroir-noir": miroirNoir(),
    },
    halo: light.halo,
    frame: new MeshPhysicalNodeMaterial({ name: "art-frame", color: "#0b0a09", roughness: 0.5 }),
    brass: new MeshPhysicalNodeMaterial({ name: "art-brass", color: "#c8a96a", metalness: 1, roughness: 0.32 }),
    // Double-sided: the Möbius band has a single side.
    polishedBrass: new MeshPhysicalNodeMaterial({ name: "art-brass-polished", color: "#d8b46e", metalness: 1, roughness: 0.08, side: DoubleSide }),
    steel: new MeshPhysicalNodeMaterial({ name: "art-steel", color: "#f2f2f4", metalness: 1, roughness: 0.03 }),
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
  };
}
