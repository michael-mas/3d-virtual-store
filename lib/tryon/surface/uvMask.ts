/**
 * Masks in canonical-UV space for surface products. Because the face mesh carries MediaPipe's canonical UVs, a
 * mask drawn once in UV space follows the face as it moves and deforms (lips opening, smiling…).
 * Pure functions (no DOM), unit-tested.
 */

export type UvPoint = readonly [number, number];

/**
 * Fills polygons (closed UV loops) with the even-odd rule into a size×size 8-bit mask: a loop inside another cuts a
 * hole (e.g. inner lip contour inside the outer one). Row 0 is v = 0, matching a DataTexture with flipY = false.
 */
export function rasterizeLoops(loops: readonly (readonly UvPoint[])[], size: number): Uint8Array {
  const mask = new Uint8Array(size * size);
  const crossings: number[] = [];
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    crossings.length = 0;
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i++) {
        const [u0, v0] = loop[i];
        const [u1, v1] = loop[(i + 1) % loop.length];
        // Half-open rule so a vertex exactly on the scanline is counted once.
        if (v0 <= v !== v1 <= v) crossings.push(u0 + ((v - v0) / (v1 - v0)) * (u1 - u0));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil(crossings[k] * size - 0.5));
      const to = Math.min(size - 1, Math.floor(crossings[k + 1] * size - 0.5));
      mask.fill(255, y * size + from, y * size + to + 1);
    }
  }
  return mask;
}

/** Separable box blur, repeated `passes` times (≈ Gaussian), in place. Softens mask edges. */
export function blurMask(mask: Uint8Array, size: number, radius: number, passes = 2): Uint8Array {
  if (radius < 1) return mask;
  const tmp = new Float32Array(size * size);
  const window = radius * 2 + 1;
  for (let p = 0; p < passes; p++) {
    // Horizontal: mask → tmp
    for (let y = 0; y < size; y++) {
      const row = y * size;
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += mask[row + Math.min(size - 1, Math.max(0, x))];
      for (let x = 0; x < size; x++) {
        tmp[row + x] = sum / window;
        sum += mask[row + Math.min(size - 1, x + radius + 1)] - mask[row + Math.max(0, x - radius)];
      }
    }
    // Vertical: tmp → mask
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(size - 1, Math.max(0, y)) * size + x];
      for (let y = 0; y < size; y++) {
        mask[y * size + x] = Math.round(sum / window);
        sum += tmp[Math.min(size - 1, y + radius + 1) * size + x] - tmp[Math.max(0, y - radius) * size + x];
      }
    }
  }
  return mask;
}

/** UV loop of a landmark contour, from the per-vertex UV array (u, v pairs). */
export function contourUv(contour: readonly number[], uvs: readonly number[]): UvPoint[] {
  return contour.map((i) => [uvs[i * 2], uvs[i * 2 + 1]] as const);
}
