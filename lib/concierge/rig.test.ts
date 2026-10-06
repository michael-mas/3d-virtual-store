import { describe, expect, it } from "vitest";
import { Group, MeshBasicMaterial, Vector3 } from "three/webgpu";
import { BODY, buildConciergeRig, DIGITS, poseConcierge, type PoseInput, type Rig } from "./rig";

const m = new MeshBasicMaterial();
const rest: PoseInput = { phase: 0, walk: 0, present: 0, lookYaw: 0, lookPitch: 0, time: 0 };

function posed(input: Partial<PoseInput>): Rig {
  const rig = buildConciergeRig({ shell: m, joint: m, flex: m });
  poseConcierge(rig, { ...rest, ...input });
  rig.root.updateMatrixWorld(true);
  return rig;
}
const world = (g: Group) => g.getWorldPosition(new Vector3());

describe("concierge rig", () => {
  it("has the full articulated anatomy: axial chain, two arms of five three-phalanx digits, two legs", () => {
    const rig = posed({});
    let joints = 0;
    rig.root.traverse((o) => {
      if (o instanceof Group) joints++;
    });
    for (const arm of [rig.arms.left, rig.arms.right]) {
      for (const d of DIGITS) expect(arm.digits[d]).toHaveLength(3);
    }
    // root + 5 axial + 2 × (4 arm joints + 15 phalanges) + 2 × 4 leg joints.
    expect(joints).toBe(1 + 5 + 2 * 19 + 2 * 4);
  });

  it("stands on the floor at rest: ankles at ankle height, symmetric", () => {
    const rig = posed({});
    const l = world(rig.legs.left.ankle);
    const r = world(rig.legs.right.ankle);
    expect(l.y).toBeGreaterThan(BODY.ankleHeight - 0.03);
    expect(l.y).toBeLessThan(BODY.ankleHeight + 0.03);
    expect(l.x).toBeCloseTo(-r.x, 6);
  });

  it("walks: the feet alternate front and back over a stride, and nothing goes below the floor", () => {
    const a = posed({ walk: 1, phase: Math.PI / 2 });
    const b = posed({ walk: 1, phase: (3 * Math.PI) / 2 });
    const la = world(a.legs.left.ankle).z;
    const lb = world(b.legs.left.ankle).z;
    expect(la * lb).toBeLessThan(0);
    expect(Math.abs(la - lb)).toBeGreaterThan(0.3);
    for (let ph = 0; ph < Math.PI * 2; ph += 0.3) {
      const rig = posed({ walk: 1, phase: ph });
      for (const leg of [rig.legs.left, rig.legs.right]) expect(world(leg.toe).y).toBeGreaterThan(-0.02);
    }
  });

  it("presents with the right hand raised and open; the left stays at rest", () => {
    const restRig = posed({});
    const presenting = posed({ present: 1 });
    expect(world(presenting.arms.right.wrist).y).toBeGreaterThan(world(restRig.arms.right.wrist).y + 0.2);
    expect(world(presenting.arms.left.wrist).y).toBeCloseTo(world(restRig.arms.left.wrist).y, 6);
    expect(presenting.arms.right.digits.index[1].rotation.x).toBeLessThan(restRig.arms.right.digits.index[1].rotation.x);
  });

  it("never produces a non-finite transform", () => {
    for (const input of [{ walk: 1, phase: 1.3, present: 1, lookYaw: 1.1, lookPitch: -0.35, time: 12.7 }, {}]) {
      const rig = posed(input);
      rig.root.traverse((o) => {
        for (const v of o.matrixWorld.elements) expect(Number.isFinite(v)).toBe(true);
      });
    }
  });
});
