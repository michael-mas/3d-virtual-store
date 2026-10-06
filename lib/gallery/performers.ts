import { abs, dot, float, normalView, oneMinus, positionViewDirection, pow } from "three/tsl";
import { CatmullRomCurve3, Mesh, MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, TubeGeometry, Vector3, type Material } from "three/webgpu";
import { BODY, buildConciergeRig, curl, DIGITS, type Arm, type Leg, type Rig } from "@/lib/concierge/rig";
import { CANONICAL_FACE_POSITIONS as P } from "@/lib/tryon/faceMesh";
import { createMannequinGeometry } from "@/lib/tryon/surface/mannequin";
import type { Pose } from "./show";
import { stageUniforms as u } from "./stage";

/**
 * The three automatons of « Les Trois Automates »: the concierge's articulated body (lib/concierge/rig.ts) in three
 * finishes (ivory porcelain, mirror chrome, onyx lacquer), each with a faceless head (MediaPipe's canonical face,
 * closed and smooth, like a Brâncuși) crossed by a glowing visor at the eyes. Their bodies catch the stage's
 * colored rim light (a fresnel term driven by the show's cues, no real lights: none are added to the scene).
 */

export type Performer = { rig: Rig; hand: Vector3 };

/** Rim light: strongest at grazing angles, in the cue's color. */
function rim() {
  const facing = abs(dot(normalView, positionViewDirection));
  return u.rimColor.mul(u.rimLevel).mul(pow(oneMinus(facing), float(2.6))).mul(1.8);
}

function lit(params: ConstructorParameters<typeof MeshPhysicalNodeMaterial>[0]): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial(params);
  m.emissiveNode = rim();
  return m;
}

const FINISHES = [
  { name: "ivory", shell: { color: "#ece6da", roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 } },
  { name: "chrome", shell: { color: "#dcdde0", metalness: 1, roughness: 0.06 } },
  { name: "onyx", shell: { color: "#0d0c0b", roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06 } },
] as const;

/** Eye-line landmarks (temple → outer corner → inner corner → bridge → … → temple). */
const VISOR = [127, 33, 133, 168, 362, 263, 356];

export function buildPerformers(): Performer[] {
  const joint = lit({ name: "automaton-brass", color: "#c8a96a", metalness: 1, roughness: 0.25 });
  const flex = lit({ name: "automaton-flex", color: "#1c1a18", roughness: 0.7 });
  const visor = new MeshBasicNodeMaterial({ name: "automaton-visor" });
  visor.colorNode = u.visorColor.mul(u.visorLevel).mul(2.4);
  const mannequin = createMannequinGeometry();
  mannequin.neck.dispose();
  const visorGeometry = new TubeGeometry(
    new CatmullRomCurve3(VISOR.map((i) => new Vector3(P[i * 3] * 0.01, P[i * 3 + 1] * 0.01 + 0.002, P[i * 3 + 2] * 0.01 + 0.004))),
    48,
    0.0032,
    6,
    false,
  );
  return FINISHES.map((f) => {
    const shell: Material = lit({ name: `automaton-${f.name}`, ...f.shell });
    const rig = buildConciergeRig({ shell, joint, flex });
    const face = new Mesh(mannequin.face, shell);
    const skull = new Mesh(mannequin.head, shell);
    skull.scale.setScalar(1.04);
    rig.head.add(face, skull, new Mesh(visorGeometry, visor));
    rig.root.traverse((o) => {
      o.frustumCulled = false;
      if (o instanceof Mesh) o.raycast = () => {};
    });
    return { rig, hand: new Vector3() };
  });
}

function poseArm(a: Arm, side: 1 | -1, p: Pose, k: "l" | "r") {
  const v = (name: string) => p[`${k}${name}` as keyof Pose];
  a.clavicle.rotation.z = side * -0.04;
  a.shoulder.rotation.set(v("ShX"), side * v("ShY"), side * v("ShZ"));
  a.elbow.rotation.x = v("ElX");
  a.elbow.rotation.y = -side * v("ElY");
  a.wrist.rotation.x = v("WrX");
  a.wrist.rotation.y = side * 1.35 * (1 - v("Open"));
  for (const digit of DIGITS) curl(a.digits[digit], v("Curl"), digit === "thumb", side);
}

function poseLeg(l: Leg, side: 1 | -1, hipX: number, hipZ: number, knee: number) {
  l.hip.rotation.set(hipX, 0, side * hipZ);
  l.knee.rotation.x = knee;
  l.ankle.rotation.x = -(hipX + knee) * 0.92;
  l.ankle.rotation.z = -side * hipZ;
  l.toe.rotation.x = 0;
}

/**
 * Puts an automaton in a pose, standing on its mark (x, z) on the stage at `floor`, facing the audience (−z).
 * Pose offsets are in the stage's frame (x toward the audience's left… as written in show.ts).
 */
export function applyPose(rig: Rig, p: Pose, mark: readonly [number, number], floor: number) {
  rig.root.position.set(mark[0] + p.x, floor, mark[1] + p.z);
  rig.root.rotation.y = Math.PI + p.yaw;
  rig.pelvis.position.y = BODY.pelvisY - p.drop;
  rig.pelvis.rotation.set(0, 0, 0);
  rig.lumbar.rotation.set(p.lumbarX, 0, p.lumbarZ);
  rig.chest.rotation.set(0, p.chestY, 0);
  rig.neck.rotation.set(p.headX * 0.4, p.headY * 0.4, 0);
  rig.head.rotation.set(p.headX * 0.6, p.headY * 0.6, p.headZ);
  poseArm(rig.arms.left, 1, p, "l");
  poseArm(rig.arms.right, -1, p, "r");
  poseLeg(rig.legs.left, 1, p.lHipX, p.lHipZ, p.lKnee);
  poseLeg(rig.legs.right, -1, p.rHipX, p.rHipZ, p.rKnee);
}
