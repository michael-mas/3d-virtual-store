import type { FacePaintDesignId } from "@/lib/products/facePaint";
import { EYE_CONTOURS, FACE_MESH_UVS, LIP_CONTOURS } from "../faceMesh";
import { canonicalToUv, landmarkCm, loopCenterCm, type CmPoint } from "./canonical";
import { blurMask, contourUv, rasterizeLoops } from "./uvMask";

/**
 * Face paint designs, authored in centimeters on the canonical face (x toward the subject's left, y up; eyes at
 * y ≈ 2.6, nose tip ≈ -1.1, chin ≈ -9.4) and rasterized once into canonical-UV masks, so they deform with the
 * tracked face. Eyes and lips are always left bare.
 */

export type FacePaintDesign = FacePaintDesignId;
export const FACE_PAINT_DESIGNS: readonly FacePaintDesign[] = ["tiger", "masquerade", "constellation"];

type Loop = CmPoint[];

/** Closed outline of a stroke along `points` with per-point width (cm): tapered brush strokes. */
export function strokeOutline(points: readonly CmPoint[], widths: readonly number[]): Loop {
  const left: CmPoint[] = [];
  const right: CmPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const [px, py] = points[Math.max(0, i - 1)];
    const [nx, ny] = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(nx - px, ny - py) || 1;
    const [ox, oy] = [(-(ny - py) / len) * (widths[i] / 2), ((nx - px) / len) * (widths[i] / 2)];
    left.push([points[i][0] + ox, points[i][1] + oy]);
    right.push([points[i][0] - ox, points[i][1] - oy]);
  }
  return [...left, ...right.reverse()];
}

/** Samples a quadratic Bézier from a to b with control c. */
function curve(a: CmPoint, c: CmPoint, b: CmPoint, n = 16): CmPoint[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as const;
  });
}

/** A brush stroke: thick at `from`, tapering to a point at `to`. */
function taperedStroke(from: CmPoint, bend: CmPoint, to: CmPoint, width: number): Loop {
  const pts = curve(from, bend, to);
  return strokeOutline(pts, pts.map((_, i) => width * Math.sin(((1 - i / (pts.length - 1)) * Math.PI) / 2) ** 0.7 + 0.02));
}

const ellipse = ([cx, cy]: CmPoint, rx: number, ry: number, n = 40): Loop =>
  Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)] as const);

function star([cx, cy]: CmPoint, outer: number, inner = outer * 0.45, points = 5, rotation = 0): Loop {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = rotation + Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
}

/** Polygons (cm) of each design, each filled on its own and combined as a union. */
export function designShapes(design: FacePaintDesign): Loop[] {
  const shapes: Loop[] = [];
  const sides = [-1, 1] as const;
  if (design === "tiger") {
    for (const s of sides) {
      // Cheek stripes: from the face edge (thick) toward the nose (point), slightly curved and descending.
      for (const [y, dy] of [
        [0.6, -0.5],
        [-1.1, -0.7],
        [-2.8, -0.8],
      ]) {
        shapes.push(taperedStroke([s * 7.6, y], [s * 5.4, y + 0.5], [s * 3.3, y + dy], 0.95));
      }
      // Forehead stripes from the temples toward the center.
      shapes.push(taperedStroke([s * 6.2, 5.0], [s * 4.2, 6.2], [s * 1.6, 6.0], 0.9));
      shapes.push(taperedStroke([s * 5.0, 7.3], [s * 3.4, 7.9], [s * 1.2, 7.4], 0.7));
      // Chin stripe.
      shapes.push(taperedStroke([s * 3.6, -8.3], [s * 2.4, -7.6], [s * 0.9, -7.4], 0.6));
    }
  } else if (design === "masquerade") {
    for (const s of sides) {
      const eye = loopCenterCm(s > 0 ? EYE_CONTOURS.left : EYE_CONTOURS.right);
      shapes.push(ellipse([eye[0], eye[1] + 0.15], 2.7, 2.05));
      // Swept wing at the outer corner.
      const [ex, ey] = eye;
      shapes.push([
        [ex + s * 1.2, ey + 1.2],
        [ex + s * 4.1, ey + 3.2],
        [ex + s * 3.2, ey + 1.2],
        [ex + s * 2.4, ey - 0.6],
      ]);
    }
    // Bridge over the nose.
    const [l, r] = [loopCenterCm(EYE_CONTOURS.right), loopCenterCm(EYE_CONTOURS.left)];
    shapes.push([
      [l[0] + 1.6, l[1] + 0.9],
      [r[0] - 1.6, r[1] + 0.9],
      [r[0] - 1.6, r[1] - 0.5],
      [0, (l[1] + r[1]) / 2 - 0.1],
      [l[0] + 1.6, l[1] - 0.5],
    ]);
  } else {
    // Stars on the subject's left cheek and temple, joined by thin lines, plus a few specks.
    const stars: [CmPoint, number][] = [
      [[5.6, 5.4], 0.55],
      [[6.6, 3.2], 0.4],
      [[5.9, 0.4], 0.62],
      [[4.3, -1.3], 0.38],
      [[6.2, -2.6], 0.5],
      [[4.9, -4.6], 0.34],
      [[3.2, 5.9], 0.32],
    ];
    stars.forEach(([c, r], i) => shapes.push(star(c, r, r * 0.42, 5, i * 0.4)));
    const path = [6, 0, 1, 2, 3, 4, 5];
    for (let i = 0; i + 1 < path.length; i++) {
      const [a, b] = [stars[path[i]][0], stars[path[i + 1]][0]];
      shapes.push(strokeOutline([a, b], [0.07, 0.07]));
    }
    for (const c of [[4.6, 3.6], [7.0, 1.4], [3.6, 1.2], [5.2, -3.4], [7.1, -0.9], [2.4, 7.0]] as CmPoint[]) {
      shapes.push(ellipse(c, 0.13, 0.13, 12));
    }
  }
  return shapes;
}

/** Areas never painted: the eyes (with a margin around the lids) and the lips. */
export function bareMask(size: number): Uint8Array {
  // Scale plus a fixed margin: eyes are thin, so a pure scale would add almost nothing above and below the lids.
  const grow = (loop: readonly number[], scale: number, marginCm: number) => {
    const [cx, cy] = loopCenterCm(loop);
    return loop.map((i) => {
      const [x, y] = landmarkCm(i);
      const [dx, dy] = [x - cx, y - cy];
      const len = Math.hypot(dx, dy) || 1;
      return canonicalToUv([cx + dx * scale + (dx / len) * marginCm, cy + dy * scale + (dy / len) * marginCm]);
    });
  };
  const eyes = [grow(EYE_CONTOURS.left, 1.15, 0.35), grow(EYE_CONTOURS.right, 1.15, 0.35)];
  const mask = new Uint8Array(size * size);
  for (const loop of [...eyes, contourUv(LIP_CONTOURS.outer, FACE_MESH_UVS)]) {
    const m = rasterizeLoops([loop], size);
    for (let i = 0; i < m.length; i++) mask[i] = Math.max(mask[i], m[i]);
  }
  return blurMask(mask, size, 2);
}

/** Rasterizes a design into a soft-edged UV mask (union of its shapes, minus eyes and lips). */
export function rasterizeDesign(design: FacePaintDesign, size: number, edgeBlur: number, bare = bareMask(size)): Uint8Array {
  const mask = new Uint8Array(size * size);
  for (const shape of designShapes(design)) {
    const m = rasterizeLoops([shape.map(canonicalToUv)], size);
    for (let i = 0; i < m.length; i++) if (m[i]) mask[i] = 255;
  }
  blurMask(mask, size, edgeBlur);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.round((mask[i] * (255 - bare[i])) / 255);
  return mask;
}

