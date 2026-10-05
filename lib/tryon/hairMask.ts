/** Texels with at least this hair confidence count toward the coverage. */
const HAIR_THRESHOLD = 0.5;
/**
 * The hair mask texture's fixed size. It is sampled with the video's UVs, so it covers the whole frame whatever the
 * video aspect; bilinear filtering softens it back on screen. Fixed, so the texture bound to the background shader
 * never changes, only its contents.
 */
export const HAIR_MASK_WIDTH = 480;
export const HAIR_MASK_HEIGHT = 270;

/**
 * Box-resamples a confidence mask (floats in [0, 1], row-major, `width` × `height`) into `outWidth` × `outHeight`
 * 8-bit texels, and measures the hair coverage (fraction of texels above HAIR_THRESHOLD).
 */
export function resampleMask(
  src: ArrayLike<number>,
  width: number,
  height: number,
  out: Uint8Array,
  outWidth = HAIR_MASK_WIDTH,
  outHeight = HAIR_MASK_HEIGHT,
): number {
  let covered = 0;
  for (let y = 0; y < outHeight; y++) {
    const y0 = Math.floor((y * height) / outHeight);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / outHeight));
    for (let x = 0; x < outWidth; x++) {
      const x0 = Math.floor((x * width) / outWidth);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / outWidth));
      let sum = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) sum += src[yy * width + xx];
      const v = sum / ((y1 - y0) * (x1 - x0));
      out[y * outWidth + x] = Math.round(Math.min(Math.max(v, 0), 1) * 255);
      if (v >= HAIR_THRESHOLD) covered++;
    }
  }
  return covered / (outWidth * outHeight);
}
