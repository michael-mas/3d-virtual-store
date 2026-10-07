import { BoxGeometry, TorusGeometry, Vector3, type BufferGeometry } from "three/webgpu";
import { gridGeometry, SKULL } from "./geometry";

/**
 * The fedora, in canonical face space (meters, origin near the nose, +y up, +z toward the camera): a felt crown that
 * rises well above the skull (it encloses the hair, unlike a cap), pinched at the front and creased along the top,
 * its top lower at the front; a brim that snaps down at the front and curls up a little at the sides; a grosgrain
 * band with a flat bow on the left side.
 */

const { center: C, radii: R } = SKULL;
/** The crown's base: an ellipse a little larger than the skull (room for hair). */
const BASE = { x: R.x * 1.14, z: R.z * 1.1 };
/** Height of the band line at the front and at the back. */
const BAND_FRONT = 0.072;
const BAND_BACK = 0.048;
/** Crown height above the band. */
const CROWN = 0.094;
const BRIM = 0.064;
const BAND = 0.017;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const bandY = (theta: number) => (BAND_FRONT + BAND_BACK) / 2 + ((BAND_FRONT - BAND_BACK) / 2) * Math.cos(theta);
/** Crown height at θ: the top slopes down toward the front. */
const crownH = (theta: number) => CROWN - 0.014 * Math.cos(theta);
/** The front pinches, either side of the front (θ = ±0.55), deepest near the top. */
const pinch = (theta: number, t: number) => {
  const p = (c: number) => Math.exp(-((wrap(theta - c) / 0.3) ** 2));
  return 1 - 0.13 * t ** 1.4 * (p(0.55) + p(-0.55));
};

function crownPoint(u: number, v: number, out: Vector3): Vector3 {
  const theta = u * Math.PI * 2;
  const y0 = bandY(theta);
  const h = crownH(theta);
  const WALL = 0.72;
  if (v <= WALL) {
    const t = v / WALL;
    const rf = (1 - 0.13 * t * t) * pinch(theta, t);
    return out.set(C.x + rf * BASE.x * Math.sin(theta), y0 + h * t, C.z + rf * BASE.z * Math.cos(theta));
  }
  // The top: from its rim in to the center, rounded at the rim, with a crease along the front-back center line.
  const s = (v - WALL) / (1 - WALL);
  const rf = 0.87 * pinch(theta, 1) * Math.cos((s * Math.PI) / 2);
  const x = rf * BASE.x * Math.sin(theta);
  const crease = 0.024 * Math.exp(-((x / 0.026) ** 2)) * Math.sin((s * Math.PI) / 2) ** 0.7;
  return out.set(C.x + x, y0 + h + 0.008 * Math.sin((s * Math.PI) / 2) - crease, C.z + rf * BASE.z * Math.cos(theta));
}

function brimPoint(u: number, s: number, out: Vector3): Vector3 {
  const theta = u * Math.PI * 2;
  const front = Math.max(Math.cos(theta), 0) ** 2;
  const back = Math.max(-Math.cos(theta), 0) ** 2;
  const side = Math.sin(theta) ** 2;
  const reach = BRIM * (1 + 0.12 * front - 0.08 * back);
  const y = bandY(theta) - 0.002 - 0.02 * s ** 1.5 * front + 0.012 * s * s * back + 0.016 * s ** 3 * side;
  const k = 1 + (reach * s) / Math.hypot(BASE.x * Math.sin(theta), BASE.z * Math.cos(theta));
  return out.set(C.x + BASE.x * Math.sin(theta) * k, y, C.z + BASE.z * Math.cos(theta) * k);
}

function bandPoint(u: number, v: number, out: Vector3): Vector3 {
  const theta = u * Math.PI * 2;
  const t = (v * BAND) / crownH(theta);
  const rf = (1 - 0.13 * t * t) * pinch(theta, t) * 1.012;
  return out.set(C.x + rf * BASE.x * Math.sin(theta), bandY(theta) - 0.001 + v * BAND, C.z + rf * BASE.z * Math.cos(theta));
}

export type Fedora = { crown: BufferGeometry; brim: BufferGeometry; band: BufferGeometry; bow: BufferGeometry[] };

export function fedoraGeometries(): Fedora {
  const crown = gridGeometry(crownPoint, 96, 40, { closedU: true, inside: new Vector3(C.x, C.y + 0.05, C.z) });
  const brim = gridGeometry(brimPoint, 96, 10, { closedU: true, inside: new Vector3(C.x, C.y - 0.3, C.z) });
  const band = gridGeometry(bandPoint, 96, 3, { closedU: true, inside: C });
  // A flat bow on the band, on the wearer's left (θ = π/2 is +x).
  const theta = Math.PI / 2 + 0.15;
  const at = new Vector3();
  bandPoint(theta / (Math.PI * 2), 0.5, at);
  const knot = new BoxGeometry(0.012, 0.02, 0.006).rotateY(Math.PI / 2).translate(at.x + 0.003, at.y, at.z);
  const loop = new TorusGeometry(0.009, 0.0025, 6, 16).scale(1, 0.55, 1).rotateY(Math.PI / 2).translate(at.x + 0.004, at.y, at.z - 0.012);
  return { crown, brim, band, bow: [knot, loop] };
}

/** What a hat's size is fitted against (canonical m): its top, its half width, and its brim line (the pivot). */
export const FEDORA_FIT = { top: BAND_BACK + CROWN + 0.014 + 0.008, halfWidth: BASE.x, pivotY: BAND_FRONT };
