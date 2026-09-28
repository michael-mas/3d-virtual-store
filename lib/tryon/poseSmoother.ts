import { Matrix4, Quaternion, Vector3 } from "three";
import { OneEuroFilter, OneEuroVector, type OneEuroParams } from "./oneEuro";

// Position in centimeters (MediaPipe units), rotation as quaternion components, uniform scale.
const POSITION: OneEuroParams = { minCutoff: 1.0, beta: 0.08, dCutoff: 1.0 };
const ROTATION: OneEuroParams = { minCutoff: 1.2, beta: 1.5, dCutoff: 1.0 };
const SCALE: OneEuroParams = { minCutoff: 0.5, beta: 0.5, dCutoff: 1.0 };

/** Smooths a stream of rigid(+uniform scale) pose matrices with One Euro filters. */
export class PoseSmoother {
  private position = new OneEuroVector(3, POSITION);
  private rotation = new OneEuroVector(4, ROTATION);
  private scale = new OneEuroFilter(SCALE);
  private prevQ: Quaternion | null = null;

  private m = new Matrix4();
  private p = new Vector3();
  private q = new Quaternion();
  private s = new Vector3();
  private buf: number[] = [];

  /**
   * @param columnMajor 4x4 matrix, column-major (MediaPipe `Matrix.data` / three `Matrix4.elements`).
   * @param timeSec monotonic timestamp in seconds.
   */
  update(columnMajor: ArrayLike<number>, timeSec: number, out: Matrix4): Matrix4 {
    this.m.fromArray(columnMajor as number[]);
    this.m.decompose(this.p, this.q, this.s);

    // q and -q are the same rotation; keep samples on one hemisphere so filtering doesn't flip.
    if (this.prevQ && this.prevQ.dot(this.q) < 0) this.q.set(-this.q.x, -this.q.y, -this.q.z, -this.q.w);

    const p = this.position.filter([this.p.x, this.p.y, this.p.z], timeSec, this.buf);
    this.p.set(p[0], p[1], p[2]);
    const q = this.rotation.filter([this.q.x, this.q.y, this.q.z, this.q.w], timeSec, this.buf);
    this.q.set(q[0], q[1], q[2], q[3]).normalize();
    this.prevQ = (this.prevQ ?? new Quaternion()).copy(this.q);
    const s = this.scale.filter((this.s.x + this.s.y + this.s.z) / 3, timeSec);
    this.s.setScalar(s);

    return out.compose(this.p, this.q, this.s);
  }

  reset() {
    this.position.reset();
    this.rotation.reset();
    this.scale.reset();
    this.prevQ = null;
  }
}
