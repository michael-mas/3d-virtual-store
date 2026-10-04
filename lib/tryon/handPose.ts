import { Matrix4, Vector3 } from "three";

/** HandLandmarker landmark indices (MediaPipe hand model: wrist, then 4 joints per finger, thumb first). */
export const HAND = {
  WRIST: 0,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  RING_MCP: 13,
  RING_PIP: 14,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
} as const;
export const HAND_LANDMARK_COUNT = 21;

export type Handedness = "Left" | "Right";
export type Finger = "index" | "middle" | "ring" | "pinky";

/**
 * Mean adult length (m) of four palm segments (wrist–index MCP, wrist–pinky MCP, index–pinky MCP, wrist–middle
 * MCP), measured on HandLandmarker world landmarks. Gives the hand its metric scale, hence its distance.
 */
export const PALM_SIZE_M = 0.088;
const PALM_SEGMENTS = [
  [HAND.WRIST, HAND.INDEX_MCP],
  [HAND.WRIST, HAND.PINKY_MCP],
  [HAND.INDEX_MCP, HAND.PINKY_MCP],
  [HAND.WRIST, HAND.MIDDLE_MCP],
] as const;

/** Index–pinky MCP distance (m) the hand products are modeled for; they scale with the tracked hand. */
export const NOMINAL_PALM_WIDTH_M = 0.07;

/**
 * Back-projects one HandLandmarker detection into camera space: three.js axes, meters, camera at the origin
 * looking down −Z with vertical FOV `vfovDeg` over a frame of `aspect` (the try-on camera).
 *
 * The shape comes from the normalized image landmarks (x, y in [0, 1], z = depth relative to the wrist on the
 * scale of x), which stay consistent where the world landmarks can degenerate. A typical palm size gives the
 * metric scale: something of size m at depth d spans m·f/d frame heights, so depth = f · meters per frame height.
 * Each point is then back-projected at its own depth. Writes 21 × xyz into `out`; returns the wrist depth (m), or
 * 0 for a degenerate detection.
 */
export function handToCamera(image: ArrayLike<number>, aspect: number, vfovDeg: number, out: Float32Array): number {
  const f = 0.5 / Math.tan((vfovDeg * Math.PI) / 360);
  // Frame-height units from the frame center; w = depth behind the wrist.
  const u = (i: number) => (image[i * 3] - 0.5) * aspect;
  const v = (i: number) => 0.5 - image[i * 3 + 1];
  const w = (i: number) => image[i * 3 + 2] * aspect;

  // 3D palm size, so a tilted hand doesn't read as a smaller (farther) one.
  let size = 0;
  for (const [a, b] of PALM_SEGMENTS) size += Math.hypot(u(a) - u(b), v(a) - v(b), w(a) - w(b));
  size /= PALM_SEGMENTS.length;
  if (!(size > 1e-4)) return 0;

  const metersPerUnit = PALM_SIZE_M / size;
  const depth = metersPerUnit * f;
  for (let i = 0; i < HAND_LANDMARK_COUNT; i++) {
    const d = depth + w(i) * metersPerUnit;
    out[i * 3] = (u(i) * d) / f;
    out[i * 3 + 1] = (v(i) * d) / f;
    out[i * 3 + 2] = -d;
  }
  return depth;
}

/** A hand's local frame in camera space. */
export type HandFrame = {
  wrist: Vector3;
  /** Wrist → middle finger base. */
  along: Vector3;
  /** Out of the back of the hand. */
  dorsal: Vector3;
  /** dorsal × along: completes the right-handed basis (side, dorsal, along). */
  side: Vector3;
  /** Index–pinky MCP distance (m). */
  palmWidth: number;
};

export const createHandFrame = (): HandFrame => ({
  wrist: new Vector3(),
  along: new Vector3(),
  dorsal: new Vector3(),
  side: new Vector3(),
  palmWidth: 0,
});

const point = (points: ArrayLike<number>, i: number, out: Vector3) =>
  out.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
const tmp = { a: new Vector3(), b: new Vector3(), c: new Vector3(), d: new Vector3() };

/**
 * The hand frame from camera-space landmarks. The palm normal is (index − pinky) × (wrist → middle) for a hand
 * MediaPipe labels "Right" and the opposite for "Left": the side the fingers curl toward, checked on MediaPipe's
 * own test images (palm or back toward the camera, and a mirrored pair).
 */
export function handFrame(points: ArrayLike<number>, handedness: Handedness, out: HandFrame): HandFrame {
  point(points, HAND.WRIST, out.wrist);
  out.along.subVectors(point(points, HAND.MIDDLE_MCP, tmp.a), out.wrist).normalize();
  const across = tmp.b.subVectors(point(points, HAND.INDEX_MCP, tmp.c), point(points, HAND.PINKY_MCP, tmp.d));
  out.palmWidth = across.length();
  across.addScaledVector(out.along, -across.dot(out.along)).normalize();
  // dorsal = −palm.
  out.dorsal.crossVectors(across, out.along).multiplyScalar(handedness === "Right" ? -1 : 1);
  out.side.crossVectors(out.dorsal, out.along);
  return out;
}

/** Hand products are modeled for NOMINAL_PALM_WIDTH_M and scaled to the tracked hand (within sane bounds). */
export const handScale = (frame: HandFrame) =>
  Math.min(Math.max(frame.palmWidth / NOMINAL_PALM_WIDTH_M, 0.75), 1.35);

/** How far up the forearm (from the wrist landmark, m at nominal size) a watch sits. */
export const WATCH_OFFSET_M = 0.022;

/**
 * Watch pose: on the wrist, a little toward the forearm. Model axes: X side, Y out of the back of the wrist (dial),
 * Z toward the fingers (crown).
 */
export function wristPose(frame: HandFrame, out: Matrix4): Matrix4 {
  const s = handScale(frame);
  const position = tmp.a.copy(frame.wrist).addScaledVector(frame.along, -WATCH_OFFSET_M * s);
  return out
    .makeBasis(frame.side, frame.dorsal, frame.along)
    .scale(tmp.b.setScalar(s))
    .setPosition(position);
}

const FINGER_JOINTS: Record<Finger, [mcp: number, pip: number]> = {
  index: [HAND.INDEX_MCP, HAND.INDEX_PIP],
  middle: [HAND.MIDDLE_MCP, HAND.MIDDLE_PIP],
  ring: [HAND.RING_MCP, HAND.RING_PIP],
  pinky: [HAND.PINKY_MCP, HAND.PINKY_PIP],
};

/** Where a ring sits between the knuckle (0) and the middle joint (1) of the finger. */
export const RING_POSITION = 0.35;

/**
 * Ring pose on the base segment of `finger`. Model axes: Y along the finger (toward the tip), Z out of the back
 * of the finger (stone), X = Y × Z.
 */
export function fingerPose(points: ArrayLike<number>, frame: HandFrame, finger: Finger, out: Matrix4): Matrix4 {
  const [mcpIndex, pipIndex] = FINGER_JOINTS[finger];
  const mcp = point(points, mcpIndex, tmp.a);
  const axis = point(points, pipIndex, tmp.b).sub(mcp);
  const position = tmp.c.copy(mcp).addScaledVector(axis, RING_POSITION);
  axis.normalize();
  const back = tmp.d.copy(frame.dorsal).addScaledVector(axis, -frame.dorsal.dot(axis)).normalize();
  const x = mcp.crossVectors(axis, back);
  return out.makeBasis(x, axis, back).scale(tmp.a.setScalar(handScale(frame))).setPosition(position);
}
