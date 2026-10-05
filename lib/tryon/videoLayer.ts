import { clamp, luminance, max, mix, oneMinus, pow, screenUV, texture, uniform, vec3, vec4 } from "three/tsl";
import {
  Color,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  RedFormat,
  RenderTarget,
  UnsignedByteType,
  type Texture,
} from "three/webgpu";
import { HAIR_MASK_HEIGHT, HAIR_MASK_WIDTH } from "./hairMask";

/**
 * Try-on is drawn in two layers over the webcam frame (itself recolored where the hair segmenter finds hair, for
 * hair color products):
 * 1. the surface layer (makeup, face paint…): the deforming face mesh drawn by an orthographic camera that covers
 *    exactly the video frame, into `surfaceLayer.target`;
 * 2. the rigid layer (glasses…): the main scene, driven by the facial transformation matrix.
 * The surface layer is composited into the scene background, under the rigid layer, so glasses sit on top of
 * makeup and transmissive lenses refract it. Both the canvas and the layer target have the video's aspect ratio
 * and cover the full frame, so the same screen UV addresses the same video pixel in both passes.
 */

const placeholder = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
placeholder.needsUpdate = true;

/**
 * The current video frame at the fragment's screen position (same mapping as three's texture background).
 * Usable by surface materials to reuse the underlying skin luminance and shading.
 */
export const videoColor = texture(placeholder, screenUV.flipY());

/** Points `videoColor` at the session's VideoTexture (or back to a black placeholder). */
export function setVideoTexture(video: Texture | null) {
  videoColor.value = video ?? placeholder;
}

export const surfaceLayer = {
  /** Linear, premultiplied RGBA (cleared to transparent). Resized to the drawing buffer by SurfaceLayer. */
  target: new RenderTarget(1, 1, { type: HalfFloatType, samples: 4 }),
  /** 1 while the layer holds this frame's surface render; 0 shows the video alone. */
  enabled: uniform(0),
};

/** Hair color: a per-pixel hair confidence mask from the segmenter, and the dye applied through it. */
export const hairLayer = {
  /** 1 while a hair color is worn and hair is tracked. */
  enabled: uniform(0),
  color: uniform(new Color("#c2185b")),
  /** How much of the dye replaces the natural color (0..1). */
  intensity: uniform(0.85),
  /** 0 keeps the hair's own lightness (natural); 1 lifts dark hair as if bleached first (vivid). */
  lift: uniform(0.2),
  /** Mix toward a light, desaturated tone (pastel). */
  pastel: uniform(0),
};

/** 8-bit hair confidence in video orientation, refilled in place by the try-on session (fixed size, see hairMask.ts). */
export const hairMaskData = new Uint8Array(HAIR_MASK_WIDTH * HAIR_MASK_HEIGHT);
const maskTexture = new DataTexture(hairMaskData, HAIR_MASK_WIDTH, HAIR_MASK_HEIGHT, RedFormat, UnsignedByteType);
maskTexture.magFilter = LinearFilter;
maskTexture.minFilter = LinearFilter;
maskTexture.needsUpdate = true;
// Data textures keep their first row (the top of the frame) at v = 0, while the video's is at v = 1 (flipY):
// unlike `videoColor`, the mask is sampled with unflipped screen UVs.
const hairMask = texture(maskTexture, screenUV);

/** Marks the hair mask for upload after `hairMaskData` was rewritten. */
export function hairMaskUpdated() {
  maskTexture.needsUpdate = true;
}

/** Video with the hair dyed: the dye's hue carried by the hair's own (optionally lifted) lightness, so strands
 * and shading survive; the soft mask edges blend it into the natural color. */
const lightness = luminance(videoColor.rgb);
const lifted = mix(lightness, pow(lightness, 0.45).mul(0.9).add(0.05), hairLayer.lift);
const tint = hairLayer.color.div(max(luminance(hairLayer.color), 0.04));
const dyedBase = clamp(tint.mul(lifted), 0, 1);
const dyed = mix(dyedBase, mix(dyedBase, vec3(1), 0.5), hairLayer.pastel);
const videoDyed = mix(videoColor.rgb, dyed, hairMask.r.mul(hairLayer.intensity).mul(hairLayer.enabled));

const layer = texture(surfaceLayer.target.texture, screenUV);

/**
 * Scene background during try-on: the (hair-dyed) video frame with the surface layer composited on top
 * (premultiplied over).
 */
export const videoWithSurface = vec4(
  videoDyed.mul(oneMinus(layer.a.mul(surfaceLayer.enabled))).add(layer.rgb.mul(surfaceLayer.enabled)),
  1,
);
