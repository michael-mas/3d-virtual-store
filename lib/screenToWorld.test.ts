import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { screenToWorld, worldToScreen } from "./screenToWorld";

const camera = (aspect: number) => {
  const c = new PerspectiveCamera(40, aspect, 0.01, 20);
  c.position.set(0.34, 0.16, 0.62);
  c.lookAt(0, -0.06, 0);
  c.updateProjectionMatrix();
  return c;
};

describe("screenToWorld", () => {
  it.each([
    [{ left: 0, top: 0, width: 1920, height: 1080 }, false],
    [{ left: 0, top: 0, width: 390, height: 844 }, false],
    [{ left: -213, top: 0, width: 1067, height: 800 }, true], // mirrored, overflowing try-on stage
  ])("round-trips a point through world space (%o, mirrored=%s)", (rect, mirrored) => {
    const cam = camera(rect.width / rect.height);
    const point = { x: rect.left + rect.width - 40, y: rect.top + 32 };
    const world = screenToWorld(point.x, point.y, rect, cam, 0.25, mirrored);
    expect(world.distanceTo(cam.position)).toBeCloseTo(0.25, 6);
    const back = worldToScreen(world, rect, cam, mirrored);
    expect(back.x).toBeCloseTo(point.x, 3);
    expect(back.y).toBeCloseTo(point.y, 3);
  });

  it("maps the rect center onto the camera's forward axis", () => {
    const rect = { left: 0, top: 0, width: 800, height: 600 };
    const cam = camera(800 / 600);
    const world = screenToWorld(400, 300, rect, cam, 1);
    const forward = cam.getWorldDirection(new Vector3());
    expect(world.clone().sub(cam.position).normalize().dot(forward)).toBeCloseTo(1, 6);
  });
});
