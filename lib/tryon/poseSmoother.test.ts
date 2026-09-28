import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { PoseSmoother } from "./poseSmoother";

const pose = (x: number, yaw: number, scale = 1) =>
  new Matrix4().compose(
    new Vector3(x, 1, -50),
    new Quaternion().setFromEuler(new Euler(0, yaw, 0)),
    new Vector3(scale, scale, scale),
  ).elements;

describe("PoseSmoother", () => {
  it("returns the first pose unchanged", () => {
    const out = new PoseSmoother().update(pose(3, 0.4, 1.1), 0, new Matrix4());
    const expected = new Matrix4().fromArray(pose(3, 0.4, 1.1));
    out.elements.forEach((v, i) => expect(v).toBeCloseTo(expected.elements[i], 5));
  });

  it("converges to a held pose", () => {
    const s = new PoseSmoother();
    const out = new Matrix4();
    s.update(pose(0, 0), 0, out);
    for (let i = 1; i <= 120; i++) s.update(pose(5, 0.5), i / 30, out);
    const p = new Vector3();
    const q = new Quaternion();
    out.decompose(p, q, new Vector3());
    expect(p.x).toBeCloseTo(5, 2);
    expect(q.angleTo(new Quaternion().setFromEuler(new Euler(0, 0.5, 0)))).toBeLessThan(1e-3);
  });

  it("does not flip when the quaternion sign alternates", () => {
    const s = new PoseSmoother();
    const out = new Matrix4();
    const q = new Quaternion().setFromEuler(new Euler(0, 0.3, 0));
    const withQ = (qq: Quaternion) => new Matrix4().compose(new Vector3(), qq, new Vector3(1, 1, 1)).elements;
    const neg = new Quaternion(-q.x, -q.y, -q.z, -q.w);
    for (let i = 0; i < 30; i++) {
      s.update(withQ(i % 2 ? neg : q), i / 30, out);
      const r = new Quaternion();
      out.decompose(new Vector3(), r, new Vector3());
      expect(r.angleTo(q)).toBeLessThan(1e-3);
    }
  });

  it("reduces translation jitter", () => {
    const s = new PoseSmoother();
    const out = new Matrix4();
    const xs: number[] = [];
    for (let i = 0; i < 90; i++) {
      s.update(pose(i % 2 ? 0.3 : -0.3, 0), i / 30, out);
      xs.push(out.elements[12]);
    }
    expect(Math.max(...xs.slice(60).map(Math.abs))).toBeLessThan(0.15);
  });
});
