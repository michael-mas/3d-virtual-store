import {
  abs,
  clamp,
  dot,
  float,
  floor,
  hash,
  hue,
  luminance,
  max,
  mix,
  normalView,
  normalize,
  oneMinus,
  pow,
  screenUV,
  sin,
  step,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import {
  Color,
  CustomBlending,
  DataTexture,
  FrontSide,
  LinearFilter,
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  RGBAFormat,
  Vector3,
} from "three/webgpu";
import { readFacePaintConfig, type FacePaintStyle } from "@/lib/products/facePaint";
import type { ProductConfig } from "@/lib/products";
import { tracking } from "../tracking";
import { videoColor } from "../videoLayer";
import { bareMask, FACE_PAINT_DESIGNS, rasterizeDesign } from "./facePaintDesigns";
import type { SurfacePreview, SurfaceProduct } from "./types";
import { blurMask } from "./uvMask";

const MASK_SIZE = 1024;
const EDGE_BLUR = 2;
const HALO_SIZE = 512;
/** Neon halo spread (texels at HALO_SIZE, 3 box passes). */
const HALO_BLUR = 9;
/** Typical linear luminance of cheek skin on a webcam; normalizes the estimated light level. */
const SKIN_REFERENCE_LUMINANCE = 0.3;

/** Packs one 8-bit mask per design into RGB (R tiger, G masquerade, B constellation). */
function packRgb(masks: Uint8Array[], size: number): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = masks[c][i];
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function downsample(mask: Uint8Array, size: number, factor: number): Uint8Array {
  const out = new Uint8Array((size / factor) ** 2);
  const s = size / factor;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let sum = 0;
      for (let j = 0; j < factor; j++) for (let i = 0; i < factor; i++) sum += mask[(y * factor + j) * size + x * factor + i];
      out[y * s + x] = sum / (factor * factor);
    }
  }
  return out;
}

let designs: { designs: DataTexture; halos: DataTexture } | null = null;

/** Shared by the try-on layer and the mannequin preview; built once (a few hundred ms), kept for the session. */
function designTextures() {
  designs ??= createDesignTextures();
  return designs;
}

/** The designs (sharp) and their blurred copies (neon halo), rasterized once in canonical-UV space. */
function createDesignTextures() {
  const bare = bareMask(MASK_SIZE);
  const sharp = FACE_PAINT_DESIGNS.map((d) => rasterizeDesign(d, MASK_SIZE, EDGE_BLUR, bare));
  const halos = sharp.map((m) => blurMask(downsample(m, MASK_SIZE, MASK_SIZE / HALO_SIZE), HALO_SIZE, HALO_BLUR, 3));
  return { designs: packRgb(sharp, MASK_SIZE), halos: packRgb(halos, HALO_SIZE) };
}

const STYLE_WEIGHTS: Record<FacePaintStyle, [number, number, number]> = {
  paint: [1, 0, 0],
  neon: [0, 1, 0],
  holographic: [0, 0, 1],
};

/**
 * Face paint on the tracked face mesh. One shader for every design and style (uniforms only):
 * - paint: the color lit by the skin's own luminance (light level + texture), like cream makeup;
 * - neon: a bright core plus an additive glow halo around the strokes;
 * - holographic: a silver base with a rainbow that shifts with the face's orientation and time, plus sparkles.
 * Glow (neon, holographic) brightens as the mouth opens (FaceLandmarker "jawOpen" blendshape).
 * Output is premultiplied (custom blending One / OneMinusSrcAlpha) so halos can add light with zero coverage.
 */
export function createFacePaintSurface(): SurfaceProduct {
  const textures = designTextures();
  const select = uniform(new Vector3(1, 0, 0));
  const styleWeights = uniform(new Vector3(0, 1, 0));
  const color = uniform(new Color("#22d3ee"));
  const opacity = uniform(0.85);
  const jawOpen = uniform(0);

  const design = dot(texture(textures.designs, uv()).rgb, select);
  const halo = dot(texture(textures.halos, uv()).rgb, select);

  // Skin light and texture under the paint.
  const base = screenUV.flipY();
  const taps = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i / 6) * Math.PI * 2;
    return luminance(videoColor.sample(base.add(vec2(Math.cos(a) * 0.006, Math.sin(a) * 0.006))).rgb);
  });
  const local = taps.reduce((a, b) => a.add(b)).div(taps.length);
  const pixel = luminance(videoColor.rgb);
  const detail = clamp(pixel.div(max(local, 0.002)), 0.6, 1.4);
  const light = clamp(pow(local.div(SKIN_REFERENCE_LUMINANCE), 0.6), 0.3, 1.3);
  const glow = float(1).add(jawOpen.mul(1.6));

  // Paint: opaque-ish cream colored by the skin's light.
  const paintRgb = color.mul(light).mul(mix(float(1), detail, 0.7));

  // Neon: white-hot core, colored halo added on top (premultiplied, coverage-free).
  const neonCore = mix(color, vec3(1, 1, 1), 0.25).mul(1.3).mul(glow);
  const neonHalo = color.mul(halo).mul(1.3).mul(glow);

  // Holographic: angle- and position-dependent rainbow over a silver base, twinkling specks.
  const facing = abs(normalize(normalView).z);
  const angle = facing.mul(5).add(uv().x.mul(14)).add(uv().y.mul(9)).add(time.mul(0.5));
  const rainbow = hue(vec3(1, 0.2, 0.2), angle);
  const silver = vec3(0.78, 0.8, 0.85).mul(light).mul(mix(float(1), detail, 0.5));
  const cell = floor(uv().mul(900));
  const seed = hash(cell.x.add(cell.y.mul(1013)));
  const sparkle = step(0.97, seed).mul(sin(time.mul(4).add(seed.mul(80))).mul(0.5).add(0.5));
  const holoRgb = mix(silver, rainbow.mul(light).mul(1.25), float(0.55).add(pow(oneMinus(facing), 1.5).mul(0.45)))
    .add(rainbow.mul(0.2).mul(glow))
    .add(vec3(sparkle).mul(glow));

  const coverage = design.mul(opacity);
  const [wPaint, wNeon, wHolo] = [styleWeights.x, styleWeights.y, styleWeights.z];
  const rgb = paintRgb
    .mul(wPaint)
    .add(neonCore.mul(wNeon))
    .add(holoRgb.mul(wHolo))
    .mul(coverage)
    .add(neonHalo.mul(wNeon).mul(opacity).mul(oneMinus(design)));

  const material = new MeshBasicNodeMaterial({
    name: "face-paint",
    side: FrontSide,
    transparent: true,
    depthWrite: true,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });
  material.colorNode = rgb;
  material.opacityNode = coverage;

  let lastConfig: ProductConfig | null = null;
  return {
    material,
    apply(config) {
      if (config === lastConfig) return;
      lastConfig = config;
      const c = readFacePaintConfig(config);
      const d = FACE_PAINT_DESIGNS.indexOf(c.design);
      select.value.set(d === 0 ? 1 : 0, d === 1 ? 1 : 0, d === 2 ? 1 : 0);
      styleWeights.value.set(...STYLE_WEIGHTS[c.style]);
      color.value.set(c.color);
      opacity.value = c.opacity;
    },
    update() {
      jawOpen.value = tracking.jawOpen;
    },
    dispose() {
      material.dispose();
    },
  };
}

/**
 * The face paint on the mannequin face (CUSTOMIZE preview, cart thumbnail): same UV designs as try-on on a
 * physical material over the mannequin's skin; neon and holographic glow through the emissive channel.
 */
export function createFacePaintPreview(skin: Color): SurfacePreview {
  const textures = designTextures();
  const select = uniform(new Vector3(1, 0, 0));
  const styleWeights = uniform(new Vector3(0, 1, 0));
  const color = uniform(new Color("#22d3ee"));
  const opacity = uniform(0.85);
  const design = dot(texture(textures.designs, uv()).rgb, select);
  const halo = dot(texture(textures.halos, uv()).rgb, select);
  const coverage = design.mul(opacity);
  const [wPaint, wNeon, wHolo] = [styleWeights.x, styleWeights.y, styleWeights.z];

  const facing = abs(normalize(normalView).z);
  const rainbow = hue(vec3(1, 0.2, 0.2), facing.mul(5).add(uv().x.mul(14)).add(uv().y.mul(9)).add(time.mul(0.5)));
  const cell = floor(uv().mul(900));
  const seed = hash(cell.x.add(cell.y.mul(1013)));
  const sparkle = step(0.97, seed).mul(sin(time.mul(4).add(seed.mul(80))).mul(0.5).add(0.5));

  // On the pale mannequin a silver base would vanish: the holographic pigment carries the rainbow itself.
  const pigment = color.mul(wPaint.add(wNeon)).add(mix(vec3(0.78, 0.8, 0.85), rainbow, 0.7).mul(wHolo));
  const material = new MeshPhysicalNodeMaterial({ name: "mannequin-face-paint" });
  material.colorNode = mix(vec3(skin.r, skin.g, skin.b), pigment, coverage);
  material.roughnessNode = mix(float(0.65), float(0.4), coverage);
  material.metalnessNode = coverage.mul(wHolo).mul(0.5);
  // Saturated core (no white-hot center): on the pale mannequin a whitened neon reads as washed out.
  material.emissiveNode = color
    .mul(design)
    .add(color.mul(halo).mul(oneMinus(design)).mul(0.8))
    .mul(wNeon)
    .mul(1.2)
    .add(rainbow.mul(0.45).add(vec3(sparkle)).mul(design).mul(wHolo))
    .mul(opacity);

  let lastConfig: ProductConfig | null = null;
  return {
    material,
    apply(config) {
      if (config === lastConfig) return;
      lastConfig = config;
      const c = readFacePaintConfig(config);
      const d = FACE_PAINT_DESIGNS.indexOf(c.design);
      select.value.set(d === 0 ? 1 : 0, d === 1 ? 1 : 0, d === 2 ? 1 : 0);
      styleWeights.value.set(...STYLE_WEIGHTS[c.style]);
      color.value.set(c.color);
      opacity.value = c.opacity;
    },
    dispose() {
      material.dispose();
    },
  };
}
