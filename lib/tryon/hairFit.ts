import { CANONICAL_FACE_POSITIONS } from "./faceMesh";

/**
 * How big a hat must be to cover the visitor's hair. From the hair mask (lib/tryon/hairMask.ts) and the face
 * landmarks, both in video-frame coordinates: how far the hair rises above the forehead (in face heights) and how
 * wide it is around the temples (in face widths). Turned into canonical-face meters, so a hat modeled on a typical
 * skull can be scaled to enclose the hair instead of letting it poke through.
 */

/** MediaPipe landmarks: top of the forehead, chin, the face's two sides. */
const FOREHEAD = 10;
const CHIN = 152;
const RIGHT = 234;
const LEFT = 454;
/** Mask confidence (0..255) counted as hair. */
const HAIR = 128;
/** Texels in a row for it to count (ignores stray specks). */
const MIN_ROW = 3;

export type HairExtent = {
  /** Height of the top of the hair above the forehead landmark, in face heights (forehead → chin). */
  above: number;
  /** Width of the hair at the temples, in face widths. */
  width: number;
};

/**
 * Measures the hair around the face. `mask`: maskWidth × maskHeight bytes, row 0 at the top of the frame;
 * `landmarks`: flat normalized x, y, z (x, y in [0, 1] of the frame); `aspect`: frame width / height.
 * Returns null without a usable face.
 */
export function measureHair(mask: Uint8Array, maskWidth: number, maskHeight: number, landmarks: ArrayLike<number>, aspect: number): HairExtent | null {
  const lx = (i: number) => landmarks[i * 3];
  const ly = (i: number) => landmarks[i * 3 + 1];
  const faceH = ly(CHIN) - ly(FOREHEAD);
  const left = Math.min(lx(RIGHT), lx(LEFT));
  const right = Math.max(lx(RIGHT), lx(LEFT));
  const faceW = (right - left) * aspect;
  if (!(faceH > 0.02) || !(faceW > 0.02)) return null;

  const rowOf = (y: number) => Math.min(maskHeight - 1, Math.max(0, Math.floor(y * maskHeight)));
  const colOf = (x: number) => Math.min(maskWidth - 1, Math.max(0, Math.floor(x * maskWidth)));
  const foreheadRow = rowOf(ly(FOREHEAD));
  // Search a band a little wider than the face, from the top of the frame down to below the forehead line.
  const c0 = colOf(left - (right - left) * 0.35);
  const c1 = colOf(right + (right - left) * 0.35);
  const bottomRow = rowOf(ly(FOREHEAD) + faceH * 0.12);
  let topRow = -1;
  let widest = 0;
  for (let r = 0; r <= bottomRow; r++) {
    let count = 0;
    let first = -1;
    let last = -1;
    for (let c = c0; c <= c1; c++) {
      if (mask[r * maskWidth + c] >= HAIR) {
        count++;
        if (first < 0) first = c;
        last = c;
      }
    }
    if (count < MIN_ROW) continue;
    if (topRow < 0) topRow = r;
    widest = Math.max(widest, (last - first + 1) / maskWidth);
  }
  if (topRow < 0) return { above: 0, width: 0 };
  return {
    above: Math.max(0, (foreheadRow - topRow) / maskHeight / faceH),
    width: (widest * aspect) / faceW,
  };
}

const cy = (i: number) => CANONICAL_FACE_POSITIONS[i * 3 + 1] / 100;
const cx = (i: number) => CANONICAL_FACE_POSITIONS[i * 3] / 100;
/** The canonical face's forehead height, height and width (m). */
export const CANONICAL = {
  forehead: cy(FOREHEAD),
  height: cy(FOREHEAD) - cy(CHIN),
  width: Math.abs(cx(LEFT) - cx(RIGHT)),
};

/**
 * Scale factors for a hat (vertical about `pivotY`, its brim line; horizontal about the head's axis) so that its top
 * clears the hair's top and its sides the hair's width, with a small margin. Never smaller than modeled, at most
 * 1.6× taller and 1.35× wider.
 */
export function hatScale(hair: HairExtent, hat: { top: number; halfWidth: number; pivotY: number }): { x: number; y: number } {
  const needTop = CANONICAL.forehead + hair.above * CANONICAL.height + 0.008;
  const needHalf = (hair.width * CANONICAL.width) / 2 + 0.006;
  const y = (needTop - hat.pivotY) / Math.max(hat.top - hat.pivotY, 1e-3);
  const x = needHalf / hat.halfWidth;
  return { x: Math.min(Math.max(x, 1), 1.35), y: Math.min(Math.max(y, 1), 1.6) };
}
