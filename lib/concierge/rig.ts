import {
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
} from "three/webgpu";

/**
 * The concierge's articulated body, after the anatomy of PointForge's VANTA-9 (github.com/abfaiaz18-ops/pointforge,
 * MIT): an axial chain pelvis → lumbar → chest → neck → head; per arm clavicle → shoulder → elbow → wrist → five
 * digits of three phalanges; per leg hip → knee → ankle → toe. Every joint is a Group at its pivot, rotated by
 * poseConcierge(); segments hang along −y from their joint (+z forward, +x the figure's left). Meters, a 1.70 m
 * figure standing on y = 0. Geometry and pose are written for three.js here; no code is taken from PointForge.
 */

export const DIGITS = ["thumb", "index", "middle", "ring", "pinky"] as const;
export type Digit = (typeof DIGITS)[number];

export type Arm = {
  clavicle: Group;
  shoulder: Group;
  elbow: Group;
  wrist: Group;
  /** Per digit, its three phalanx joints (base → tip). */
  digits: Record<Digit, [Group, Group, Group]>;
};
export type Leg = { hip: Group; knee: Group; ankle: Group; toe: Group };
export type Rig = {
  root: Group;
  pelvis: Group;
  lumbar: Group;
  chest: Group;
  neck: Group;
  /** Where the head attaches: the canonical face origin (near the nose). */
  head: Group;
  arms: { left: Arm; right: Arm };
  legs: { left: Leg; right: Leg };
  geometries: BufferGeometry[];
};

export type RigMaterials = { shell: Material; joint: Material; flex: Material };

/** Body dimensions (m). */
export const BODY = {
  pelvisY: 0.97,
  hipX: 0.095,
  thigh: 0.44,
  shin: 0.42,
  ankleHeight: 0.075,
  lumbar: 0.16,
  chest: 0.27,
  neck: 0.1,
  shoulderX: 0.19,
  upperArm: 0.28,
  forearm: 0.25,
  palm: 0.075,
} as const;

const PHALANGES: Record<Digit, [number, number, number]> = {
  thumb: [0.032, 0.026, 0.022],
  index: [0.034, 0.024, 0.02],
  middle: [0.037, 0.026, 0.021],
  ring: [0.034, 0.024, 0.02],
  pinky: [0.027, 0.019, 0.017],
};

export function buildConciergeRig(m: RigMaterials): Rig {
  const geometries: BufferGeometry[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const joint = (x = 0, y = 0, z = 0) => {
    const g = new Group();
    g.position.set(x, y, z);
    return g;
  };
  /** A tapered limb shell from the joint down `length`: radii at top and bottom, flattened front to back. */
  const limb = (length: number, rTop: number, rBottom: number, depth = 0.85) => {
    const profile = [
      [0, 0],
      [rTop * 0.75, 0],
      [rTop, -length * 0.12],
      [(rTop + rBottom) / 2 + 0.004, -length * 0.5],
      [rBottom, -length * 0.88],
      [rBottom * 0.75, -length],
      [0, -length],
    ].map(([r, y]) => new Vector2(r, y));
    return new Mesh(keep(new LatheGeometry(profile, 20).scale(1, 1, depth)), m.shell);
  };
  const ball = (r: number, material = m.joint) => new Mesh(keep(new SphereGeometry(r, 18, 12)), material);
  const band = (r: number, y: number, material = m.joint) => {
    const mesh = new Mesh(keep(new TorusGeometry(r, 0.0045, 6, 32).rotateX(Math.PI / 2)), material);
    mesh.position.y = y;
    return mesh;
  };

  const root = new Group();
  root.name = "concierge-rig";

  // ---------------------------------------------------------------- axial chain
  const pelvis = joint(0, BODY.pelvisY, 0);
  const hipsShell = new Mesh(
    keep(
      new LatheGeometry(
        [
          [0, -0.09],
          [0.1, -0.09],
          [0.15, -0.03],
          [0.14, 0.04],
          [0.1, 0.07],
          [0, 0.07],
        ].map(([r, y]) => new Vector2(r, y)),
        28,
      ).scale(1.05, 1, 0.7),
    ),
    m.shell,
  );
  pelvis.add(hipsShell, band(0.115, 0.07));
  root.add(pelvis);

  const lumbar = joint(0, 0.07, 0);
  // Segmented abdomen: three flexible rings between pelvis and chest.
  for (let i = 0; i < 3; i++) {
    const ring = new Mesh(keep(new CylinderGeometry(0.085 - i * 0.004, 0.09 - i * 0.004, 0.04, 24).scale(1.15, 1, 0.75)), m.flex);
    ring.position.y = 0.025 + i * 0.048;
    lumbar.add(ring);
  }
  pelvis.add(lumbar);

  const chest = joint(0, BODY.lumbar, 0);
  const chestShell = new Mesh(
    keep(
      new LatheGeometry(
        [
          [0, 0],
          [0.1, 0],
          [0.15, 0.08],
          [0.175, 0.17],
          [0.16, 0.24],
          [0.1, 0.285],
          [0.045, 0.3],
          [0, 0.3],
        ].map(([r, y]) => new Vector2(r, y)),
        32,
      ).scale(1.18, 1, 0.68),
    ),
    m.shell,
  );
  chest.add(chestShell, band(0.1, 0.0), band(0.172, 0.17));
  lumbar.add(chest);

  const neck = joint(0, BODY.chest + 0.02, 0.0);
  const neckShell = new Mesh(keep(new CylinderGeometry(0.032, 0.04, BODY.neck, 18)), m.flex);
  neckShell.position.y = BODY.neck / 2;
  neck.add(neckShell, band(0.042, 0.005));
  chest.add(neck);

  const head = joint(0, BODY.neck + 0.075, 0.025);
  neck.add(head);

  // ---------------------------------------------------------------- arms
  const buildArm = (side: 1 | -1): Arm => {
    const clavicle = joint(side * 0.05, BODY.chest - 0.03, 0);
    const clavicleBar = new Mesh(keep(new CapsuleGeometry(0.018, 0.1, 4, 10).rotateZ(Math.PI / 2)), m.flex);
    clavicleBar.position.x = side * 0.07;
    clavicle.add(clavicleBar);
    chest.add(clavicle);

    const shoulder = joint(side * (BODY.shoulderX - 0.05), 0, 0);
    // A floating shoulder pauldron over the ball joint.
    const pauldron = new Mesh(keep(new SphereGeometry(0.068, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 0.9, 1.05)), m.shell);
    pauldron.position.y = 0.012;
    shoulder.add(ball(0.045), pauldron, limb(BODY.upperArm, 0.042, 0.034));
    clavicle.add(shoulder);

    const elbow = joint(0, -BODY.upperArm, 0);
    elbow.rotation.order = "YXZ";
    elbow.add(ball(0.033), limb(BODY.forearm, 0.036, 0.027));
    shoulder.add(elbow);

    const wrist = joint(0, -BODY.forearm, 0);
    // Palm along −y, fingers continuing it; the thumb on the inner side (toward the body's midline).
    const palm = new Mesh(keep(new CapsuleGeometry(0.026, BODY.palm - 0.03, 4, 12).scale(1.25, 1, 0.55)), m.shell);
    palm.position.y = -BODY.palm / 2;
    wrist.add(ball(0.022, m.flex), palm);
    elbow.add(wrist);

    const digits = {} as Record<Digit, [Group, Group, Group]>;
    DIGITS.forEach((digit, i) => {
      const lengths = PHALANGES[digit];
      const base =
        digit === "thumb"
          ? joint(-side * 0.025, -0.02, 0.012)
          : joint(-side * (0.021 - (i - 1) * 0.0135), -BODY.palm + 0.004, 0);
      if (digit === "thumb") base.rotation.set(0, 0, -side * 0.7);
      const chain: Group[] = [];
      let parent: Group = wrist;
      let at = base;
      lengths.forEach((len, k) => {
        const radius = (digit === "thumb" ? 0.0085 : 0.0075) - k * 0.0012;
        const seg = new Mesh(keep(new CapsuleGeometry(radius, Math.max(len - radius * 2, 0.002), 3, 8)), k === 2 ? m.joint : m.shell);
        seg.position.y = -len / 2;
        at.add(seg);
        parent.add(at);
        chain.push(at);
        parent = at;
        at = joint(0, -len, 0);
      });
      digits[digit] = chain as [Group, Group, Group];
    });
    return { clavicle, shoulder, elbow, wrist, digits };
  };

  // ---------------------------------------------------------------- legs
  const buildLeg = (side: 1 | -1): Leg => {
    const hip = joint(side * BODY.hipX, -0.06, 0);
    hip.add(ball(0.052), limb(BODY.thigh, 0.062, 0.045));
    pelvis.add(hip);
    const knee = joint(0, -BODY.thigh, 0);
    const kneeCap = ball(0.036);
    kneeCap.position.z = 0.012;
    knee.add(kneeCap, limb(BODY.shin, 0.047, 0.032));
    hip.add(knee);
    const ankle = joint(0, -BODY.shin, 0);
    // Foot: a wedge from heel to the ball of the foot, a separate toe cap.
    const foot = new Mesh(keep(new CapsuleGeometry(0.035, 0.12, 4, 12).rotateX(Math.PI / 2).scale(1, 0.62, 1)), m.shell);
    foot.position.set(0, -BODY.ankleHeight + 0.03, 0.035);
    ankle.add(ball(0.028, m.flex), foot);
    knee.add(ankle);
    const toe = joint(0, -BODY.ankleHeight + 0.022, 0.125);
    const toeCap = new Mesh(keep(new CapsuleGeometry(0.03, 0.03, 4, 10).rotateX(Math.PI / 2).scale(1, 0.55, 1)), m.joint);
    toeCap.position.z = 0.025;
    toe.add(toeCap);
    ankle.add(toe);
    return { hip, knee, ankle, toe };
  };

  const rig: Rig = {
    root,
    pelvis,
    lumbar,
    chest,
    neck,
    head,
    arms: { left: buildArm(1), right: buildArm(-1) },
    legs: { left: buildLeg(1), right: buildLeg(-1) },
    geometries,
  };
  return rig;
}

export type PoseInput = {
  /** Gait phase (rad), advanced by the distance walked. */
  phase: number;
  /** Walk amount 0..1 (from speed). */
  walk: number;
  /** Presenting a piece with the right hand, 0..1. */
  present: number;
  /** Head turn toward the visitor (rad, yaw; pitch). */
  lookYaw: number;
  lookPitch: number;
  /** Seconds, for breathing and idle sway (0 for reduced motion). */
  time: number;
};

/** Curls a digit's three joints (0 = straight, 1 = closed), the thumb crossing toward the palm. */
export function curl(chain: [Group, Group, Group], amount: number, thumb: boolean, side: 1 | -1) {
  const [a, b, c] = chain;
  if (thumb) {
    a.rotation.x = amount * 0.5;
    a.rotation.y = -side * amount * 0.4;
    b.rotation.x = amount * 0.6;
    c.rotation.x = amount * 0.5;
  } else {
    a.rotation.x = amount * 1.1;
    b.rotation.x = amount * 1.3;
    c.rotation.x = amount * 0.9;
  }
}

/** Poses the whole rig from a few high-level inputs (gait, presenting gesture, gaze, breathing). */
export function poseConcierge(rig: Rig, p: PoseInput) {
  const w = p.walk;
  const s = Math.sin(p.phase);
  const c = Math.cos(p.phase);
  const breathe = Math.sin(p.time * 1.4);

  // Pelvis: bobs twice per stride, sways and turns with the legs; a slight idle weight shift.
  rig.pelvis.position.y = BODY.pelvisY - 0.018 * w + 0.022 * w * Math.abs(c) + 0.003 * breathe * (1 - w);
  rig.pelvis.rotation.y = 0.08 * w * s;
  rig.pelvis.rotation.z = 0.025 * w * c + 0.012 * Math.sin(p.time * 0.4) * (1 - w);
  // Chest counter-rotates; breathing lifts it a little.
  rig.lumbar.rotation.x = 0.04 * w;
  rig.chest.rotation.y = -0.12 * w * s;
  rig.chest.rotation.x = -0.015 * breathe * (1 - w);

  // Legs: hip swings ±0.45 rad, the knee bends on the swing, the ankle keeps the foot level, the toe rolls off.
  for (const [leg, ph] of [
    [rig.legs.left, p.phase],
    [rig.legs.right, p.phase + Math.PI],
  ] as const) {
    const ls = Math.sin(ph);
    const swing = Math.max(0, Math.sin(ph - Math.PI / 2));
    leg.hip.rotation.x = -0.34 * w * ls - 0.03;
    leg.knee.rotation.x = (0.08 + 0.75 * swing) * w + 0.05;
    leg.ankle.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x) * 0.85;
    leg.toe.rotation.x = -0.35 * w * Math.max(0, ls);
  }

  // Arms swing opposite the legs; at rest they hang relaxed, elbows soft, fingers loosely curled.
  const arm = (a: Arm, side: 1 | -1, swingPhase: number, present: number) => {
    const swing = 0.32 * w * Math.sin(swingPhase);
    a.clavicle.rotation.z = side * -0.04;
    a.shoulder.rotation.x = swing - 0.06 - present * 1.05;
    a.shoulder.rotation.z = side * (0.09 + present * 0.45);
    a.shoulder.rotation.y = side * present * 0.25;
    a.elbow.rotation.x = -(0.22 + 0.25 * w * Math.max(0, -Math.sin(swingPhase))) + present * 0.05;
    // Presenting: forearm rolls palm-up, wrist opens.
    a.elbow.rotation.y = -side * present * 1.2;
    a.wrist.rotation.x = -0.1 + present * 0.35;
    // Palms face the thighs at rest; the presenting hand turns open toward the piece.
    a.wrist.rotation.y = side * 1.35 * (1 - present);
    const relaxed = 0.35 + 0.05 * Math.sin(p.time * 0.9 + side);
    for (const digit of DIGITS) curl(a.digits[digit], relaxed * (1 - present) + 0.08 * present, digit === "thumb", side);
  };
  arm(rig.arms.left, 1, p.phase + Math.PI, 0);
  arm(rig.arms.right, -1, p.phase, p.present);

  // Gaze: neck takes part, head finishes.
  rig.neck.rotation.y = p.lookYaw * 0.35;
  rig.neck.rotation.x = p.lookPitch * 0.3;
  rig.head.rotation.y = p.lookYaw * 0.65;
  rig.head.rotation.x = p.lookPitch * 0.7;
}

/** Stride length (m per gait cycle) and the speed (m/s) at which the walk is full. */
export const STRIDE = 1.15;
export const FULL_WALK_SPEED = 1.2;
