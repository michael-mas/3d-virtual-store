import { FLOOR_Y, GALLERY } from "@/lib/explore/layout";

/**
 * « Les Trois Automates », a mechanical ballet for three automatons, light and sound, in five acts: the whole
 * score as pure functions of the show's clock (seconds). Choreography (a pose per automaton), lighting cues (house
 * lights, six moving heads, cyclorama, the swarm of light, rim light on the bodies), the director's shot list for
 * the camera, and the act titles. The renderer (components/canvas/Theatre.tsx), the camera (CameraRig) and the
 * music (score.ts) all read the same clock, so picture, light and sound stay in sync.
 */

export type Vec3 = [number, number, number];

export const BPM = 120;
export const BEAT = 60 / BPM;

export type ActId = "prelude" | "eveil" | "mecanique" | "miroir" | "finale" | "salut";
export type Act = { id: ActId; start: number; end: number; numeral: string; title: string; line: string };

/** The acts (titles stay in French: they are the work's; the lines go through the i18n catalog). */
export const ACTS: readonly Act[] = [
  { id: "prelude", start: 0, end: 8, numeral: "", title: "Prélude", line: "In the dark, three figures wait." },
  { id: "eveil", start: 8, end: 22, numeral: "I", title: "Éveil", line: "Light touches them, one after the other." },
  { id: "mecanique", start: 22, end: 44, numeral: "II", title: "Mécanique", line: "The pulse takes hold: unison, canon, mirror." },
  { id: "miroir", start: 44, end: 64, numeral: "III", title: "Miroir", line: "Now they follow you. Move." },
  { id: "finale", start: 64, end: 76, numeral: "IV", title: "Finale", line: "Everything rises toward the light." },
  { id: "salut", start: 76, end: 84, numeral: "", title: "Salut", line: "Thank you." },
];
export const SHOW_DURATION = ACTS[ACTS.length - 1].end;
/** The act in which the visitor is part of the piece (the camera is theirs, the automatons follow them). */
export const INTERACTIVE_ACT: ActId = "miroir";

export const actAt = (t: number): Act => ACTS.find((a) => t < a.end) ?? ACTS[ACTS.length - 1];

// ---------------------------------------------------------------- stage geometry

const S = GALLERY.stage;
export const STAGE_TOP = FLOOR_Y + S.height;
export const STAGE_CENTER: Vec3 = [(S.minX + S.maxX) / 2, STAGE_TOP, (S.minZ + S.maxZ) / 2];
/** The automatons' marks on the stage (floor plan). */
export const MARKS: readonly [number, number][] = GALLERY.performers.map(([x, z]) => [x, z]);
/** Six moving heads on the truss, above the front of the stage. */
export const FIXTURES: readonly Vec3[] = [-2.75, -1.65, -0.55, 0.55, 1.65, 2.75].map((x) => [x, FLOOR_Y + GALLERY.truss.y, GALLERY.truss.z]);

// ---------------------------------------------------------------- easing

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** 0 before `a`, 1 after `b`, smooth between. */
const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
/** Robotic snap: most of the move in the first 30 % of `duration`, then a tiny settle. */
const snap = (x: number) => {
  const t = clamp01(x);
  return 1 - (1 - t) ** 4;
};

// ---------------------------------------------------------------- choreography

/** Joint angles (rad) and offsets (m) of one automaton. Arm/leg values are written for the figure's own side. */
export const JOINTS = [
  "x",
  "z",
  "yaw",
  "drop",
  "lumbarX",
  "lumbarZ",
  "chestY",
  "headX",
  "headY",
  "headZ",
  "lShX",
  "lShY",
  "lShZ",
  "lElX",
  "lElY",
  "lWrX",
  "lOpen",
  "lCurl",
  "rShX",
  "rShY",
  "rShZ",
  "rElX",
  "rElY",
  "rWrX",
  "rOpen",
  "rCurl",
  "lHipX",
  "lHipZ",
  "lKnee",
  "rHipX",
  "rHipZ",
  "rKnee",
] as const;
export type Joint = (typeof JOINTS)[number];
export type Pose = Record<Joint, number>;

const NEUTRAL: Pose = {
  x: 0,
  z: 0,
  yaw: 0,
  drop: 0,
  lumbarX: 0,
  lumbarZ: 0,
  chestY: 0,
  headX: 0,
  headY: 0,
  headZ: 0,
  lShX: -0.06,
  lShY: 0,
  lShZ: 0.1,
  lElX: -0.25,
  lElY: 0,
  lWrX: -0.1,
  lOpen: 0,
  lCurl: 0.35,
  rShX: -0.06,
  rShY: 0,
  rShZ: 0.1,
  rElX: -0.25,
  rElY: 0,
  rWrX: -0.1,
  rOpen: 0,
  rCurl: 0.35,
  lHipX: -0.03,
  lHipZ: 0,
  lKnee: 0.05,
  rHipX: -0.03,
  rHipZ: 0,
  rKnee: 0.05,
};

const pose = (p: Partial<Pose>): Pose => ({ ...NEUTRAL, ...p });
/** Same values on both arms (and legs). */
const both = (p: { ShX?: number; ShY?: number; ShZ?: number; ElX?: number; ElY?: number; WrX?: number; Open?: number; Curl?: number }) =>
  Object.fromEntries(Object.entries(p).flatMap(([k, v]) => [[`l${k}`, v], [`r${k}`, v]])) as Partial<Pose>;

/** Left ↔ right. */
export function mirrorPose(p: Pose): Pose {
  const out = { ...p };
  for (const j of JOINTS) {
    if (j.startsWith("l") && j !== "lumbarX" && j !== "lumbarZ") {
      const r = `r${j.slice(1)}` as Joint;
      out[j] = p[r];
      out[r] = p[j];
    }
  }
  out.x = -p.x;
  out.yaw = -p.yaw;
  out.lumbarZ = -p.lumbarZ;
  out.chestY = -p.chestY;
  out.headY = -p.headY;
  out.headZ = -p.headZ;
  return out;
}

export function blendPose(a: Pose, b: Pose, k: number): Pose {
  const out = {} as Pose;
  for (const j of JOINTS) out[j] = lerp(a[j], b[j], k);
  return out;
}

export const POSES = {
  neutral: NEUTRAL,
  /** Asleep: head bowed, shoulders fallen, hands closed. */
  rest: pose({ headX: 0.75, lumbarX: 0.2, drop: 0.02, ...both({ ShX: 0.06, ShZ: 0.03, ElX: -0.05, Curl: 0.65 }) }),
  /** Waking: chin up, arms floating out, hands opening. */
  rise: pose({ headX: -0.18, lumbarX: -0.05, ...both({ ShX: -0.25, ShZ: 0.38, ElX: -0.45, Open: 1, Curl: 0.1, WrX: 0.2 }) }),
  open: pose({ headX: -0.1, ...both({ ShZ: 1.45, ElX: -0.1, Open: 1, Curl: 0.05 }) }),
  vUp: pose({ headX: -0.38, lumbarX: -0.1, drop: -0.02, ...both({ ShZ: 2.55, ElX: -0.05, Open: 1, Curl: 0 }) }),
  /** Arms straight ahead, palms down. */
  front: pose({ ...both({ ShX: -1.57, ShZ: 0.05, ElX: 0, Curl: 0.05 }) }),
  /** Arms ahead, forearms up. */
  gate: pose({ headX: -0.1, ...both({ ShX: -1.5, ShZ: 0.15, ElX: -1.5, Open: 1, Curl: 0.1 }) }),
  punchL: pose({ chestY: -0.35, headY: -0.2, lShX: -1.57, lShZ: 0.05, lElX: 0, lCurl: 0.9, rShX: 0.35, rShZ: 0.15, rElX: -2.0, rCurl: 0.9 }),
  plie: pose({ drop: 0.1, lumbarX: -0.05, ...both({ ShZ: 1.2, ElX: -0.5, Open: 1, Curl: 0.1 }), lHipX: -0.45, lHipZ: 0.22, lKnee: 0.9, rHipX: -0.45, rHipZ: 0.22, rKnee: 0.9 }),
  lean: pose({ x: -0.18, lumbarZ: 0.28, headZ: -0.15, lShZ: 0.5, lElX: -0.3, rShZ: 1.9, rElX: -0.1, rOpen: 1, rCurl: 0.05, lHipZ: 0.12, rKnee: 0.2, rHipX: -0.1 }),
  /** Conducting: right arm raised ahead, hand open; left arm balancing. */
  conduct: pose({ headX: -0.32, rShX: -2.2, rShZ: 0.3, rElX: -0.3, rOpen: 1, rCurl: 0.05, lShX: -0.6, lShZ: 0.5, lElX: -0.9, lOpen: 1, lCurl: 0.15 }),
  bow: pose({ lumbarX: 0.6, headX: 0.45, drop: 0.03, lShX: 0.25, lShZ: 0.05, lElX: -0.1, rShX: -0.7, rShZ: -0.05, rElX: -1.9, rCurl: 0.4 }),
};

/** The beat sequence of the mechanical act, eight moves per phrase. */
const PHRASE: readonly Pose[] = [POSES.front, POSES.gate, POSES.front, POSES.punchL, mirrorPose(POSES.punchL), POSES.vUp, POSES.open, POSES.plie];

/**
 * Pose of automaton `i` (0 left, 1 center, 2 right, as the audience sees them) at show time `t`. `visitor` is the
 * visitor's position on the floor plan (the third act follows it), `time` is free-running (breathing).
 */
export function poseAt(t: number, i: number, visitor: readonly [number, number]): Pose {
  const breathe = Math.sin(t * 1.3 + i) * 0.015;
  const withBreath = (p: Pose): Pose => ({ ...p, lumbarX: p.lumbarX + breathe, headX: p.headX + breathe * 0.5 });
  // Waking order: center, left, right.
  const order = [1, 0, 2].indexOf(i);
  if (t < 8) return withBreath(POSES.rest);
  if (t < 22) {
    const wake = 9 + order * 1.8;
    const a = blendPose(POSES.rest, POSES.rise, ramp(t, wake, wake + 2.6));
    const b = blendPose(a, POSES.open, ramp(t, 15 + order * 0.6, 17.5 + order * 0.6));
    return withBreath(blendPose(b, POSES.neutral, ramp(t, 20.2, 21.8)));
  }
  if (t < 44) return mechanicalPose(t, i);
  if (t < 64) {
    const mirror = mirrorActPose(t, i, visitor);
    // Out of the last mechanical move, into the mirror.
    return blendPose(mechanicalPose(44, i), mirror, ramp(t, 44, 45.6));
  }
  if (t < 76) {
    const from = mirrorActPose(64, i, visitor);
    const up = blendPose(POSES.open, POSES.vUp, 0.5 + 0.5 * Math.sin((t - 64) * 1.6 + i));
    const rise = blendPose(from, up, ramp(t, 64, 66.5));
    // Two hits, then held high into the blackout.
    const hit = t >= 72 && t < 73 ? POSES.open : POSES.vUp;
    return t < 71.5 ? rise : blendPose(rise, hit, snap((t - 71.5) / 0.25));
  }
  const bow = blendPose(POSES.vUp, POSES.bow, ramp(t, 76.4 + order * 0.25, 78 + order * 0.25));
  return blendPose(bow, POSES.neutral, ramp(t, 81, 83.5));
}

function mechanicalPose(t: number, i: number): Pose {
  const beats = (t - 22) / BEAT;
  const phrase = Math.floor(beats / 8);
  // Phrase 2 is a canon (each automaton a beat behind the previous), phrase 3 mirrors the outer two.
  const delay = phrase === 1 ? i : 0;
  const b = beats - delay;
  if (b < 0) return PHRASE[PHRASE.length - 1];
  const k = Math.floor(b);
  const move = (n: number) => {
    const p = PHRASE[((n % PHRASE.length) + PHRASE.length) % PHRASE.length];
    return phrase === 2 && i === 0 ? mirrorPose(p) : p;
  };
  // The first move starts from the standing pose the awakening ended in.
  const from = k === 0 ? POSES.neutral : move(k - 1);
  const to = k >= 40 ? POSES.open : move(k);
  const p = blendPose(from, to, snap((b - k) / 0.6));
  // Phrase 4: the bodies twist with the beat.
  if (phrase === 3) p.chestY += Math.sin(b * Math.PI) * 0.25 * (i - 1 || 1);
  return p;
}

function mirrorActPose(t: number, i: number, visitor: readonly [number, number]): Pose {
  const [mx] = MARKS[i];
  // How far the visitor stands to the left/right of this automaton, seen from the stage (stage faces −z).
  const side = Math.max(-1, Math.min(1, (visitor[0] - mx) / 3));
  const wave = Math.sin(t * 1.4 - i * 0.9);
  if (i === 1) {
    // The center automaton conducts the swarm: a slow figure eight with its right hand.
    const p = { ...POSES.conduct };
    p.rShX += Math.sin(t * 1.3) * 0.45;
    p.rShZ += Math.sin(t * 0.65) * 0.55;
    p.rElX += Math.cos(t * 1.3) * 0.2;
    p.headY = -side * 0.35;
    return p;
  }
  // The outer two lean toward the visitor, one arm reaching out to them. Facing the audience, an automaton's right
  // (local −x) is world +x: `lean` (bending to its right) leans toward +x.
  const toward = side > 0 ? POSES.lean : mirrorPose(POSES.lean);
  const p = blendPose(POSES.neutral, toward, Math.abs(side) * 0.9 + 0.1);
  p.x += side * 0.25;
  p.headY = -side * 0.5;
  p.lShZ += wave * 0.25;
  p.rShZ -= wave * 0.25;
  return p;
}

// ---------------------------------------------------------------- lighting cues

export type BeamCue = { aim: Vec3; color: Vec3; intensity: number };
export type Cue = {
  /** Gallery lights (1 full … 0 off). */
  house: number;
  /** Cinema bars (0 … 1). */
  letterbox: number;
  cyclo: { color: Vec3; level: number };
  beams: BeamCue[];
  /** Weights of the swarm's formations: cloud, ring, helix, sphere, rain; and its glow. */
  swarm: { weights: [number, number, number, number, number]; intensity: number; color: Vec3; attract: number };
  /** Colored rim light on the automatons' bodies, and their visors. */
  rim: { color: Vec3; level: number };
  visor: number;
  /** A full-screen flash, 0 … 1 (accent hits; never more than a few per second). */
  flash: number;
};

const WHITE: Vec3 = [1, 0.95, 0.88];
const AMBER: Vec3 = [1, 0.55, 0.18];
const GOLD: Vec3 = [1, 0.72, 0.32];
const MAGENTA: Vec3 = [1, 0.12, 0.55];
const CYAN: Vec3 = [0.1, 0.75, 1];
const NIGHT: Vec3 = [0.15, 0.25, 1];
const BLACK: Vec3 = [0, 0, 0];

const mark3 = (i: number, y = STAGE_TOP): Vec3 => [MARKS[i][0], y, MARKS[i][1]];

/** The lighting state at show time `t`. `visitor` is the visitor's floor position; `hand` the conductor's hand. */
export function cueAt(t: number, visitor: readonly [number, number]): Cue {
  const visitorFloor: Vec3 = [visitor[0], FLOOR_Y, visitor[1]];
  const beats = (t - 22) / BEAT;
  const beamOff = (i: number): BeamCue => ({ aim: mark3(Math.min(2, Math.floor(i / 2))), color: WHITE, intensity: 0 });
  let beams: BeamCue[] = FIXTURES.map((_, i) => beamOff(i));
  let cyclo = { color: BLACK, level: 0 };
  let swarm: Cue["swarm"] = { weights: [1, 0, 0, 0, 0], intensity: 0.25, color: GOLD, attract: 0 };
  let rim = { color: WHITE, level: 0 };
  let visor = 0.15;
  let flash = 0;
  // House lights: down over the prelude, a glow during the bow, back up at the end.
  let house = lerp(1, 0.1, ramp(t, 0, 4));
  if (t > 74) house = 0;
  if (t > 76) house = lerp(0, 0.45, ramp(t, 76, 78));
  if (t > 81) house = lerp(0.45, 1, ramp(t, 81, 84));
  const letterbox = ramp(t, 0, 2) * (1 - ramp(t, 82, 84));

  if (t < 8) {
    // A single white spot finds the center automaton.
    beams[2] = { aim: mark3(1), color: WHITE, intensity: ramp(t, 3, 7) * 0.8 };
    beams[3] = { aim: mark3(1), color: WHITE, intensity: ramp(t, 4, 7.5) * 0.6 };
    swarm = { ...swarm, intensity: ramp(t, 2, 8) * 0.35 };
  } else if (t < 22) {
    // Dawn: each automaton gets its warm beams as it wakes; the cyclorama rises amber.
    beams = FIXTURES.map((_, f) => {
      const who = Math.min(2, Math.floor(f / 2));
      const order = [1, 0, 2].indexOf(who);
      return { aim: mark3(who), color: lerp3(WHITE, AMBER, ramp(t, 10, 18)), intensity: ramp(t, 8.5 + order * 1.8, 10.5 + order * 1.8) * 0.85 };
    });
    cyclo = { color: AMBER, level: ramp(t, 9, 20) * 0.75 };
    rim = { color: AMBER, level: ramp(t, 9, 16) * 0.8 };
    visor = lerp(0.15, 1, ramp(t, 9, 14));
    swarm = { weights: [1, 0, 0, 0, 0], intensity: 0.35 + ramp(t, 12, 20) * 0.3, color: GOLD, attract: 0 };
  } else if (t < 44) {
    // The pulse: beams sweep in figures, colors switch every bar, a flash on each phrase's downbeat; the last phrase
    // sweeps over the audience.
    const bar = Math.floor(beats / 4);
    const color = bar % 2 === 0 ? MAGENTA : CYAN;
    const phrase = Math.floor(beats / 8);
    const onBeat = Math.exp(-(beats % 1) * 6);
    beams = FIXTURES.map((f, i) => {
      const w = beats * Math.PI * 0.25 + i * 0.9;
      const overAudience = phrase === 3;
      const aim: Vec3 = overAudience
        ? [Math.sin(w) * 3, FLOOR_Y, lerp(GALLERY.audience[1] - 1.5, GALLERY.audience[1] + 1.2, 0.5 + 0.5 * Math.cos(w * 0.7))]
        : [f[0] * 0.4 + Math.sin(w) * 1.8, STAGE_TOP, STAGE_CENTER[2] + Math.cos(w * 1.3) * 1.2];
      return { aim, color: i % 2 === bar % 2 ? color : WHITE, intensity: 0.55 + 0.45 * onBeat };
    });
    cyclo = { color: lerp3(color, BLACK, 0.35), level: 0.55 + 0.35 * onBeat };
    rim = { color, level: 0.7 + 0.3 * onBeat };
    visor = 0.6 + 0.4 * onBeat;
    flash = beats % 8 < 1 && beats >= 0 ? Math.exp(-(beats % 8) * 7) * 0.35 : 0;
    swarm = { weights: [0.2, 0.8, 0, 0, 0], intensity: 0.55 + 0.3 * onBeat, color: lerp3(GOLD, color, 0.4), attract: 0 };
  } else if (t < 64) {
    // The mirror: the light leaves the stage to find the visitor; night blue; the swarm flows to the conductor's hand.
    const k = ramp(t, 44, 46);
    beams = FIXTURES.map((f, i) => {
      const onVisitor = i === 2 || i === 3;
      const aim: Vec3 = onVisitor ? visitorFloor : mark3(i < 2 ? 0 : 2);
      return { aim, color: onVisitor ? WHITE : NIGHT, intensity: (onVisitor ? 0.4 : 0.5) * k };
    });
    cyclo = { color: NIGHT, level: 0.7 };
    rim = { color: NIGHT, level: 0.9 };
    visor = 1;
    swarm = { weights: [0.15, 0, 0.35, 0, 0], intensity: 0.9, color: [0.55, 0.75, 1], attract: ramp(t, 46, 50) * 0.85 };
  } else if (t < 76) {
    // Finale: everything converges on the center, opens into a golden fan, a sphere of light, then blackout.
    const converge = ramp(t, 64, 68);
    beams = FIXTURES.map((f, i) => {
      const fan: Vec3 = [(i - 2.5) * 1.6, FLOOR_Y, GALLERY.audience[1] + 0.5];
      const aim = t < 70 ? lerp3(mark3(Math.min(2, Math.floor(i / 2))), mark3(1), converge) : lerp3(mark3(1), fan, ramp(t, 70, 71));
      return { aim, color: lerp3(WHITE, GOLD, converge), intensity: t < 74 ? 0.6 + 0.4 * converge : 0 };
    });
    const hits = [72, 73].map((h) => (t >= h ? Math.exp(-(t - h) * 6) : 0));
    flash = Math.max(...hits) * 0.45;
    cyclo = { color: GOLD, level: t < 74 ? 0.5 + 0.5 * ramp(t, 66, 72) : 0 };
    rim = { color: GOLD, level: t < 74 ? 1 : 0 };
    visor = t < 74 ? 1 : 0;
    swarm = { weights: [0, 0, 0.2, ramp(t, 66, 70), ramp(t, 72, 74)], intensity: t < 74 ? 1 : lerp(1, 0, ramp(t, 74, 75)), color: GOLD, attract: 0 };
  } else {
    // The bow, in a warm front light.
    beams = FIXTURES.map((_, i) => ({ aim: mark3(Math.min(2, Math.floor(i / 2))), color: WHITE, intensity: ramp(t, 76, 77) * (1 - ramp(t, 81, 84)) * 0.7 }));
    cyclo = { color: AMBER, level: 0.35 * (1 - ramp(t, 81, 84)) };
    rim = { color: AMBER, level: 0.6 * (1 - ramp(t, 81, 84)) };
    visor = 0.6;
    swarm = { weights: [0, 0, 0, 0, 1], intensity: 0.6 * (1 - ramp(t, 78, 82)), color: GOLD, attract: 0 };
  }
  return { house, letterbox, cyclo, beams, swarm, rim, visor, flash };
}

// ---------------------------------------------------------------- the director's shot list

export type Shot = { position: Vec3; target: Vec3 };

const F = STAGE_TOP;
const [CX, , CZ] = STAGE_CENTER;
const between = (t: number, a: number, b: number, from: Shot, to: Shot): Shot => {
  const k = smooth((t - a) / (b - a));
  return { position: lerp3(from.position, to.position, k), target: lerp3(from.target, to.target, k) };
};

/** Four-beat cuts through the mechanical act. */
const MECHANICAL_SHOTS: readonly [Shot, Shot][] = [
  // Low and wide, looking up at the line of automatons.
  [{ position: [0, F + 0.25, 13.2], target: [0, F + 1.6, CZ] }, { position: [0.3, F + 0.3, 13.5], target: [0, F + 1.6, CZ] }],
  // Profile, tracking along the line.
  [{ position: [-3.6, F + 1.4, 15.2], target: [-0.5, F + 1.2, CZ - 0.2] }, { position: [-3.4, F + 1.5, 16.6], target: [0.5, F + 1.2, CZ] }],
  // From behind them, the beams over the audience.
  [{ position: [0.4, F + 1.9, 18.2], target: [0, F + 1.2, 12.5] }, { position: [-0.4, F + 2.1, 18.2], target: [0, F + 1.1, 12.5] }],
  // Close on the right automaton.
  [{ position: [2.4, F + 1.55, 14.6], target: [1.5, F + 1.4, 16.1] }, { position: [2.1, F + 1.5, 14.8], target: [1.5, F + 1.45, 16.1] }],
  // Overhead, the pattern of the bodies.
  [{ position: [0, F + 3.7, 14.4], target: [0, F + 0.2, 16.0] }, { position: [0, F + 3.8, 14.8], target: [0, F + 0.2, 16.1] }],
];

/** The camera at show time `t`, or null when the camera is the visitor's (the interactive act). */
export function shotAt(t: number): Shot | null {
  if (t < 8) {
    return between(t, 0, 8, { position: [0, F + 2.3, 11.0], target: [0, F + 1.1, CZ] }, { position: [0, F + 1.8, 12.6], target: [0, F + 1.2, CZ] });
  }
  if (t < 15) {
    return between(t, 8, 15, { position: [-2.4, F + 1.55, 14.3], target: [-1.5, F + 1.45, 16.1] }, { position: [-0.7, F + 1.6, 14.4], target: [0, F + 1.5, 16.4] });
  }
  if (t < 22) {
    return between(t, 15, 22, { position: [1.9, F + 0.7, 13.5], target: [0, F + 1.4, CZ] }, { position: [1.3, F + 3.2, 12.6], target: [0, F + 1.0, CZ] });
  }
  if (t < 44) {
    const beats = (t - 22) / BEAT;
    const cut = Math.floor(beats / 4);
    const [from, to] = MECHANICAL_SHOTS[cut % MECHANICAL_SHOTS.length];
    return between(beats - cut * 4, 0, 4, from, to);
  }
  if (t < 64) return null;
  if (t < 76) {
    // A slow orbit that climbs, around the converging light.
    const k = smooth((t - 64) / 12);
    const a = lerp(-0.95, 0.95, k);
    const r = 3.6;
    return { position: [CX + Math.sin(a) * r, F + lerp(1.0, 2.9, k), CZ - Math.cos(a) * r], target: [CX, F + 1.4, CZ] };
  }
  return between(t, 76, 80, { position: [0, F + 1.4, 13.0], target: [0, F + 1.3, CZ] }, { position: [0, F + 1.7, 12.0], target: [0, F + 1.2, CZ] });
}
