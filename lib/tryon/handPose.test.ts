import { Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/handDetections.json";
import { MEDIAPIPE_VERTICAL_FOV_DEG } from "./constants";
import {
  createHandFrame,
  fingerPose,
  HAND,
  HAND_LANDMARK_COUNT,
  handFrame,
  handScale,
  handToCamera,
  RING_POSITION,
  WATCH_OFFSET_M,
  wristPose,
  type Handedness,
} from "./handPose";

const F = 0.5 / Math.tan((MEDIAPIPE_VERTICAL_FOV_DEG * Math.PI) / 360);
const at = (p: Float32Array, i: number) => new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);

describe.each(fixture.detections)("$source ($handedness, $facing toward the camera)", (d) => {
  const points = new Float32Array(HAND_LANDMARK_COUNT * 3);
  const depth = handToCamera(d.image, d.aspect, MEDIAPIPE_VERTICAL_FOV_DEG, points);

  it("lands at a plausible distance and reprojects onto the detection", () => {
    expect(depth).toBeGreaterThan(0.08);
    expect(depth).toBeLessThan(1.5);
    for (let i = 0; i < HAND_LANDMARK_COUNT; i++) {
      const p = at(points, i);
      expect(0.5 + (p.x * F) / -p.z / d.aspect).toBeCloseTo(d.image[i * 3], 5);
      expect(0.5 - (p.y * F) / -p.z).toBeCloseTo(d.image[i * 3 + 1], 5);
    }
  });

  it("has an adult palm width", () => {
    const width = at(points, HAND.INDEX_MCP).distanceTo(at(points, HAND.PINKY_MCP));
    expect(width).toBeGreaterThan(0.045);
    expect(width).toBeLessThan(0.1);
  });

  it("puts the back of the hand on the right side", () => {
    const frame = handFrame(points, d.handedness as Handedness, createHandFrame());
    // Camera space: +Z points toward the camera.
    expect(Math.sign(frame.dorsal.z)).toBe(d.facing === "back" ? 1 : -1);
    expect(Math.abs(frame.dorsal.z)).toBeGreaterThan(0.8);
    // Orthonormal, right-handed basis.
    expect(frame.side.clone().cross(frame.dorsal).dot(frame.along)).toBeCloseTo(1, 5);
  });
});

describe("product poses", () => {
  const d = fixture.detections[0];
  const points = new Float32Array(HAND_LANDMARK_COUNT * 3);
  handToCamera(d.image, d.aspect, MEDIAPIPE_VERTICAL_FOV_DEG, points);
  const frame = handFrame(points, d.handedness as Handedness, createHandFrame());
  const s = handScale(frame);

  it("places the watch up the forearm, dial out of the back of the wrist", () => {
    const m = wristPose(frame, new Matrix4());
    const position = new Vector3().setFromMatrixPosition(m);
    expect(position.distanceTo(frame.wrist)).toBeCloseTo(WATCH_OFFSET_M * s, 6);
    const y = new Vector3().setFromMatrixColumn(m, 1).divideScalar(s);
    expect(y.dot(frame.dorsal)).toBeCloseTo(1, 5);
  });

  it("places a ring on the base of the chosen finger, along it", () => {
    const m = fingerPose(points, frame, "ring", new Matrix4());
    const mcp = at(points, HAND.RING_MCP);
    const pip = at(points, HAND.RING_PIP);
    const position = new Vector3().setFromMatrixPosition(m);
    expect(position.distanceTo(mcp.clone().lerp(pip, RING_POSITION))).toBeCloseTo(0, 6);
    const y = new Vector3().setFromMatrixColumn(m, 1).normalize();
    expect(y.dot(pip.sub(mcp).normalize())).toBeCloseTo(1, 5);
  });

  it("rejects a degenerate detection", () => {
    expect(handToCamera(new Float32Array(HAND_LANDMARK_COUNT * 3), 1, 63, new Float32Array(63))).toBe(0);
  });
});
