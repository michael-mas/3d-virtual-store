import { abs, float, positionLocal, smoothstep, uniform, vec3 } from "three/tsl";
import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
  type MeshPhysicalNodeMaterial,
} from "three/webgpu";
import { CANONICAL_FACE_POSITIONS as P, EYE_CONTOURS, FACE_MESH_TRIANGLES, FACE_MESH_UVS, LIP_CONTOURS, MOUTH_TRIANGLES } from "@/lib/tryon/faceMesh";

/**
 * The concierge's living face, on MediaPipe's canonical face (meters, +z out of the face): the eye openings and the
 * mouth are cut out of the mesh (the triangles inside each eye contour, and the mouth-closing triangles), eyeballs
 * sit in the sockets (black glass, brass iris, glowing pupil) behind porcelain lids that blink, brass brows follow
 * the eyebrow landmarks, and the jaw opens in the vertex shader (TSL), with a dark cavity behind the lips.
 */

const CM = 0.01;
/** MediaPipe eyebrow landmarks (outer → inner), right and left. */
const BROWS = { right: [70, 63, 105, 66, 107], left: [300, 293, 334, 296, 336] };
/** Jaw travel at full opening (m), and the upper lip's lift. */
const JAW_DROP = 0.011;
const LIP_LIFT = 0.0018;

const at = (i: number) => new Vector3(P[i * 3] * CM, P[i * 3 + 1] * CM, P[i * 3 + 2] * CM);
function centroid(loop: readonly number[]): Vector3 {
  const c = new Vector3();
  for (const i of loop) c.add(at(i));
  return c.divideScalar(loop.length);
}

/** The face mesh with open eyes and mouth. */
function openFaceGeometry(): BufferGeometry {
  const eyes = [new Set(EYE_CONTOURS.left), new Set(EYE_CONTOURS.right)];
  const mouth = new Set(MOUTH_TRIANGLES);
  const index: number[] = [];
  for (let t = 0; t < FACE_MESH_TRIANGLES.length / 3; t++) {
    const tri = [FACE_MESH_TRIANGLES[t * 3], FACE_MESH_TRIANGLES[t * 3 + 1], FACE_MESH_TRIANGLES[t * 3 + 2]];
    if (mouth.has(t)) continue;
    if (eyes.some((eye) => tri.every((v) => eye.has(v)))) continue;
    index.push(...tri);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(P.map((v) => v * CM), 3));
  g.setAttribute("uv", new Float32BufferAttribute(FACE_MESH_UVS as number[], 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export type FaceRig = {
  group: Group;
  /** 0 closed .. 1 fully open. */
  jaw: { value: number };
  /** Per eye: the eyeball (rotates to look) and the lid (scale.y: 0 open … 1 closed). */
  eyes: { ball: Group; lid: Mesh }[];
  brows: Mesh[];
  browRest: number[];
  geometries: BufferGeometry[];
};

export type FaceMaterials = { porcelain: MeshPhysicalNodeMaterial; glass: Material; iris: Material; pupil: Material; cavity: Material; brass: Material };

export function buildFace(m: FaceMaterials): FaceRig {
  const geometries: BufferGeometry[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const group = new Group();
  group.name = "concierge-face";

  // Jaw: below the lip line, vertices drop (fully from the lower lip down), fading out toward the jaw's sides;
  // the upper lip lifts a little.
  const jaw = uniform(0);
  const lipLine = centroid(LIP_CONTOURS.inner).y;
  const y = positionLocal.y;
  const sides = float(1).sub(smoothstep(0.035, 0.065, abs(positionLocal.x)));
  const lower = smoothstep(lipLine - 0.0005, lipLine - 0.004, y).mul(sides);
  const upper = smoothstep(lipLine + 0.009, lipLine + 0.0005, y).mul(smoothstep(lipLine - 0.0005, lipLine + 0.0005, y)).mul(sides);
  const drop = lower.mul(JAW_DROP).negate().add(upper.mul(LIP_LIFT));
  m.porcelain.positionNode = positionLocal.add(vec3(0, drop.mul(jaw), lower.mul(jaw).mul(-0.003)));
  const face = new Mesh(keep(openFaceGeometry()), m.porcelain);
  group.add(face);

  // Mouth cavity, seen when the lips part.
  const mouth = centroid(LIP_CONTOURS.inner);
  const cavity = new Mesh(keep(new SphereGeometry(1, 20, 12).scale(0.024, 0.012, 0.016)), m.cavity);
  cavity.position.set(0, mouth.y - 0.004, mouth.z - 0.016);
  group.add(cavity);

  const eyes = [EYE_CONTOURS.left, EYE_CONTOURS.right].map((loop) => {
    const c = centroid(loop);
    const r = 0.0118;
    const ball = new Group();
    // Set back so its front sits just behind the opening.
    ball.position.set(c.x, c.y, c.z - r + 0.0012);
    const glass = new Mesh(keep(new SphereGeometry(r, 24, 16)), m.glass);
    const iris = new Mesh(keep(new TorusGeometry(r * 0.42, r * 0.07, 8, 32)), m.iris);
    iris.position.z = r * 0.93;
    const pupil = new Mesh(keep(new SphereGeometry(r * 0.24, 16, 8).scale(1, 1, 0.35)), m.pupil);
    pupil.position.z = r * 0.97;
    ball.add(glass, iris, pupil);
    // Lid: a porcelain shell over the opening, scaled from nothing (open) to the full opening (closed).
    const lid = new Mesh(keep(new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(0.015, 0.0055, 0.003)), m.porcelain);
    lid.position.set(c.x, c.y + 0.0012, c.z + 0.0008);
    lid.scale.y = 0.001;
    group.add(ball, lid);
    return { ball, lid };
  });

  // Brows: brass strokes along the eyebrow landmarks, just proud of the skin.
  const brows = [BROWS.left, BROWS.right].map((ids) => {
    const points = ids.map((i) => at(i).add(new Vector3(0, 0.001, 0.0025)));
    const tube = new Mesh(keep(new TubeGeometry(new CatmullRomCurve3(points), 24, 0.0011, 6, false)), m.brass);
    group.add(tube);
    return tube;
  });

  return {
    group,
    jaw,
    eyes,
    brows,
    browRest: brows.map((b) => b.position.y),
    geometries,
  };
}
