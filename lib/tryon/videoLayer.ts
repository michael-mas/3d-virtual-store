import { oneMinus, screenUV, texture, uniform, vec4 } from "three/tsl";
import { DataTexture, HalfFloatType, RenderTarget, type Texture } from "three/webgpu";

/**
 * Try-on is drawn in two layers over the webcam frame:
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

const layer = texture(surfaceLayer.target.texture, screenUV);

/** Scene background during try-on: video frame with the surface layer composited on top (premultiplied over). */
export const videoWithSurface = vec4(
  videoColor.rgb.mul(oneMinus(layer.a.mul(surfaceLayer.enabled))).add(layer.rgb.mul(surfaceLayer.enabled)),
  1,
);
