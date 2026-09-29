import {
  clamp,
  dot,
  float,
  floor,
  hash,
  luminance,
  max,
  mix,
  normalView,
  normalize,
  pow,
  screenUV,
  sin,
  smoothstep,
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
  DataTexture,
  FrontSide,
  LinearFilter,
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  RGBAFormat,
} from "three/webgpu";
import { readLipstickConfig, type LipFinish } from "@/lib/products/lipstick";
import type { ProductConfig } from "@/lib/products";
import { FACE_MESH_TRIANGLES, FACE_MESH_UVS, LIP_CONTOURS } from "../faceMesh";
import { videoColor } from "../videoLayer";
import { mouthClosedAmount, mouthOpenness } from "./mouth";
import type { SurfacePreview, SurfaceProduct } from "./types";
import { blurMask, contourUv, rasterizeLoops } from "./uvMask";

const MASK_SIZE = 512;
/** Box-blur radius (texels, 2 passes) of the outer lip edge: soft, no sticker outline. */
const MASK_BLUR = 3;
/** The mouth opening follows the inner contour closely (a wider blur would uncover the lips' inner edge). */
const INNER_BLUR = 1;
/** Width (texels) of the darker band along the lip line, where the lips meet or curl into the mouth. */
const LIP_LINE_BLUR = 5;

/**
 * Per-finish look. All finishes share one shader (uniforms only, no rebuild when switching).
 * - texture: how much of the lips' own fine texture (creases) shows through
 * - maxDetail: cap on local brightening; low values flatten the real glints (matte)
 * - spec / shininess: synthetic Blinn-Phong highlight on the tracked mesh normals
 * - videoGloss: amplifies the real highlights present in the video
 * - coverage: opacity of the pigment; metal: tints highlights with the shade; glitter: sparkle density
 */
export const LIP_FINISH_LOOK: Record<
  LipFinish,
  { texture: number; maxDetail: number; spec: number; shininess: number; videoGloss: number; coverage: number; metal: number; glitter: number; lift: number }
> = {
  matte: { texture: 0.55, maxDetail: 1.04, spec: 0, shininess: 8, videoGloss: 0, coverage: 0.95, metal: 0, glitter: 0, lift: 1 },
  satin: { texture: 0.8, maxDetail: 1.35, spec: 0.18, shininess: 24, videoGloss: 0.25, coverage: 0.93, metal: 0, glitter: 0, lift: 1 },
  gloss: { texture: 0.7, maxDetail: 1.6, spec: 0.9, shininess: 140, videoGloss: 1.1, coverage: 0.86, metal: 0, glitter: 0, lift: 0.95 },
  metallic: { texture: 0.7, maxDetail: 1.5, spec: 0.75, shininess: 36, videoGloss: 0.6, coverage: 0.95, metal: 1, glitter: 1, lift: 0.9 },
};

/** Typical linear luminance of bare lips on a webcam; normalizes the estimated light level. */
const LIP_REFERENCE_LUMINANCE = 0.2;

/**
 * UV mask channels: R = lips (outer contour, soft edge), G = mouth opening (inner contour, 1-texel edge),
 * B = proximity to the inner contour (a wide blur of it), used to darken the lip line.
 */
let lipMask: DataTexture | null = null;

/** Shared by the try-on layer and the mannequin preview; built once, kept for the session. */
function lipMaskTexture(): DataTexture {
  lipMask ??= createLipMaskTexture();
  return lipMask;
}

function createLipMaskTexture(): DataTexture {
  const rasterize = (loop: readonly number[], blur: number) =>
    blurMask(rasterizeLoops([contourUv(loop, FACE_MESH_UVS)], MASK_SIZE), MASK_SIZE, blur);
  const channels = [
    rasterize(LIP_CONTOURS.outer, MASK_BLUR),
    rasterize(LIP_CONTOURS.inner, INNER_BLUR),
    rasterize(LIP_CONTOURS.inner, LIP_LINE_BLUR),
  ];
  const data = new Uint8Array(MASK_SIZE * MASK_SIZE * 4);
  for (let i = 0; i < MASK_SIZE * MASK_SIZE; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = channels[c][i];
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, MASK_SIZE, MASK_SIZE, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Face mesh triangles overlapping the lips' UV bounds (plus the blur margin): the only ones worth shading.
 * Includes the mouth-opening triangles: when the lips touch, the thin gap between them is painted as a crease.
 */
function lipTriangles(): number[] {
  const loop = contourUv(LIP_CONTOURS.outer, FACE_MESH_UVS);
  const margin = (MASK_BLUR * 2 + 2) / MASK_SIZE;
  const minU = Math.min(...loop.map((p) => p[0])) - margin;
  const maxU = Math.max(...loop.map((p) => p[0])) + margin;
  const minV = Math.min(...loop.map((p) => p[1])) - margin;
  const maxV = Math.max(...loop.map((p) => p[1])) + margin;
  const out: number[] = [];
  for (let t = 0; t < FACE_MESH_TRIANGLES.length / 3; t++) {
    const tri = [0, 1, 2].map((k) => FACE_MESH_TRIANGLES[t * 3 + k]);
    const us = tri.map((i) => FACE_MESH_UVS[i * 2]);
    const vs = tri.map((i) => FACE_MESH_UVS[i * 2 + 1]);
    if (Math.max(...us) >= minU && Math.min(...us) <= maxU && Math.max(...vs) >= minV && Math.min(...vs) <= maxV) {
      out.push(...tri);
    }
  }
  return out;
}

/** Average luminance of the video on a ring of `radius` (screen UV units) around the fragment. */
function ringLuminance(radius: number, taps: number) {
  const base = screenUV.flipY();
  const tap = (i: number) => {
    const a = (i / taps) * Math.PI * 2;
    return luminance(videoColor.sample(base.add(vec2(Math.cos(a) * radius, Math.sin(a) * radius))).rgb);
  };
  let sum = tap(0);
  for (let i = 1; i < taps; i++) sum = sum.add(tap(i));
  return sum.div(taps);
}

/**
 * Lipstick on the tracked lips. The pigment replaces the lips' color but keeps what the camera sees of their
 * shape: the light level (local luminance average, compressed) and the fine texture (pixel luminance over that
 * average). Finishes add highlights from the mesh normals and/or boost the real ones in the video.
 * The UV-space mask (outer contour minus inner contour, blurred) keeps the mouth interior uncovered.
 */
export function createLipstickSurface(): SurfaceProduct {
  const color = uniform(new Color("#b3123a"));
  const look = {
    texture: uniform(0.8),
    maxDetail: uniform(1.35),
    spec: uniform(0),
    shininess: uniform(24),
    videoGloss: uniform(0),
    coverage: uniform(1),
    metal: uniform(0),
    glitter: uniform(0),
    lift: uniform(1),
  };
  const maskSample = texture(lipMaskTexture(), uv());
  /** 1 while the lips touch, 0 once they part (from the landmarks, every frame). */
  const mouthClosed = uniform(1);
  const opening = maskSample.g;
  // Lips, plus the gap between them while they touch; the mouth interior stays uncovered once it opens.
  const mask = maskSample.r.mul(mix(float(1).sub(opening), float(1), mouthClosed));
  // Darker toward the lip line, like real lips where they meet; the closed gap itself is a deep crease.
  const lipLine = float(1).sub(smoothstep(0.05, 0.5, maskSample.b).mul(0.45)).mul(float(1).sub(opening.mul(0.6)));

  // Light and texture from the video under the lips.
  const pixel = luminance(videoColor.rgb);
  const local = ringLuminance(0.006, 8);
  const detail = clamp(pixel.div(max(local, 0.002)), 0.5, look.maxDetail);
  // Light level on this part of the lips, compressed: shading survives, bare-lip color mostly doesn't.
  const light = clamp(pow(local.div(LIP_REFERENCE_LUMINANCE), 0.5), 0.35, 1.2);
  const pigment = color.mul(look.lift).mul(light).mul(lipLine).mul(mix(float(1), detail, look.texture));

  // Highlights: key light above-front and a weaker fill, on the tracked mesh normals (view = layer space).
  const n = normalize(normalView);
  const view = vec3(0, 0, 1);
  const key = pow(max(dot(n, normalize(vec3(-0.25, 0.65, 1).add(view))), 0), look.shininess);
  const fill = pow(max(dot(n, normalize(vec3(0.5, 0.1, 1).add(view))), 0), look.shininess).mul(0.35);
  const glints = smoothstep(1.12, 1.6, pixel.div(max(local, 0.002))).mul(look.videoGloss);
  const specular = key.add(fill).mul(look.spec).add(glints).mul(light).mul(float(1).sub(opening));
  const specColor = mix(vec3(1, 1, 1), color.mul(2.2), look.metal);

  // Metallic sparkle: sparse cells in UV space that twinkle.
  const cell = floor(uv().mul(700));
  const seed = hash(cell.x.add(cell.y.mul(997)));
  const sparkle = step(0.965, seed).mul(sin(time.mul(3).add(seed.mul(60))).mul(0.5).add(0.5)).mul(look.glitter).mul(light);

  const material = new MeshBasicNodeMaterial({ name: "lipstick", side: FrontSide, transparent: true, depthWrite: true });
  // Metallic pigments are darker in their body color; the highlights carry the color instead.
  const body = pigment.mul(float(1).sub(look.metal.mul(0.35)));
  material.colorNode = body.add(specColor.mul(specular.add(sparkle)));
  material.opacityNode = mask.mul(max(look.coverage, clamp(specular, 0, 1)));

  let lastConfig: ProductConfig | null = null;
  return {
    material,
    triangles: lipTriangles(),
    apply(config) {
      if (config === lastConfig) return;
      lastConfig = config;
      const c = readLipstickConfig(config);
      color.value.set(c.color);
      const l = LIP_FINISH_LOOK[c.finish];
      for (const key of Object.keys(look) as (keyof typeof look)[]) look[key].value = l[key];
    },
    update(landmarks, aspect) {
      mouthClosed.value = mouthClosedAmount(mouthOpenness(landmarks, aspect));
    },
    dispose() {
      material.dispose();
    },
  };
}


/** Physical-material look of each finish on the mannequin (lit by the scene instead of the webcam). */
const PREVIEW_FINISH: Record<LipFinish, { roughness: number; clearcoat: number; metal: number; glitter: number }> = {
  matte: { roughness: 0.9, clearcoat: 0, metal: 0, glitter: 0 },
  satin: { roughness: 0.45, clearcoat: 0, metal: 0, glitter: 0 },
  gloss: { roughness: 0.3, clearcoat: 1, metal: 0, glitter: 0 },
  metallic: { roughness: 0.3, clearcoat: 0, metal: 0.8, glitter: 1 },
};

/**
 * The lipstick on the mannequin face (CUSTOMIZE preview, cart thumbnail): same UV lip mask as try-on, applied to
 * a physical material over the mannequin's skin, so shade and finish react to the scene lights.
 */
export function createLipstickPreview(skin: Color): SurfacePreview {
  const color = uniform(new Color("#b3123a"));
  const finish = { roughness: uniform(0.45), clearcoat: uniform(0), metal: uniform(0), glitter: uniform(0) };
  const maskSample = texture(lipMaskTexture(), uv());
  const lips = maskSample.r;
  const lipLine = float(1).sub(smoothstep(0.05, 0.5, maskSample.b).mul(0.35));
  const cell = floor(uv().mul(700));
  const seed = hash(cell.x.add(cell.y.mul(997)));
  const sparkle = step(0.965, seed).mul(sin(time.mul(3).add(seed.mul(60))).mul(0.5).add(0.5));

  const material = new MeshPhysicalNodeMaterial({ name: "mannequin-lipstick" });
  material.colorNode = mix(vec3(skin.r, skin.g, skin.b), color.mul(lipLine), lips);
  material.roughnessNode = mix(float(0.65), finish.roughness, lips);
  material.metalnessNode = lips.mul(finish.metal);
  material.clearcoatNode = lips.mul(finish.clearcoat);
  material.clearcoatRoughnessNode = float(0.04);
  material.emissiveNode = color.mul(2).mul(sparkle).mul(finish.glitter).mul(lips);

  let lastConfig: ProductConfig | null = null;
  return {
    material,
    apply(config) {
      if (config === lastConfig) return;
      lastConfig = config;
      const c = readLipstickConfig(config);
      color.value.set(c.color);
      const f = PREVIEW_FINISH[c.finish];
      for (const key of Object.keys(finish) as (keyof typeof finish)[]) finish[key].value = f[key];
    },
    dispose() {
      material.dispose();
    },
  };
}
