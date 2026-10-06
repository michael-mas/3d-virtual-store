import { abs, dot, length, normalView, oneMinus, positionViewDirection, pow, uniform, uv } from "three/tsl";
import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  Vector3,
} from "three/webgpu";
import { FLOOR_Y, GALLERY } from "@/lib/explore/layout";
import { STAGE_TOP, type BeamCue, type Vec3 } from "./show";

/**
 * The theatre's lighting rig: six moving heads on the truss, each a black yoke and head with a glowing lens, a beam
 * drawn as an additive open cone (brighter where it faces the eye and near its source, so it reads as light in haze)
 * and its pool of light where it lands. No real lights: the scene's lighting (and its shaders) stay unchanged.
 */

/** Beam spread: cone radius per meter of throw. */
const SPREAD = 0.11;

export type Fixture = { group: Group; head: Group; beam: Mesh; pool: Mesh; color: { value: Color }; intensity: { value: number } };

const DOWN = new Vector3(0, -1, 0);
const dir = new Vector3();
const target = new Vector3();

export function buildFixtures(positions: readonly Vec3[]): Fixture[] {
  const cone = new CylinderGeometry(0.03, 1, 1, 40, 1, true).translate(0, -0.5, 0);
  const disc = new CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  const lensDisc = new CircleGeometry(0.055, 24).rotateX(Math.PI / 2);
  const body = new MeshPhysicalNodeMaterial({ name: "fixture-body", color: "#0b0a0a", roughness: 0.4, metalness: 0.6 });
  const headGeometry = new CylinderGeometry(0.07, 0.09, 0.22, 20).translate(0, -0.06, 0);
  const yokeGeometry = new CylinderGeometry(0.012, 0.012, 0.16, 8).translate(0, 0.08, 0);

  return positions.map((p, i) => {
    const color = uniform(new Color(1, 1, 1));
    const intensity = uniform(0);
    const beamMaterial = new MeshBasicNodeMaterial({ name: `beam-${i}`, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const facing = abs(dot(normalView, positionViewDirection));
    beamMaterial.colorNode = color.mul(intensity).mul(pow(facing, 2)).mul(pow(uv().y, 1.6).mul(0.85).add(0.15)).mul(0.42);
    const poolMaterial = new MeshBasicNodeMaterial({ name: `pool-${i}`, transparent: true, depthWrite: false, blending: AdditiveBlending });
    const r = length(uv().sub(0.5)).mul(2);
    poolMaterial.colorNode = color.mul(intensity).mul(pow(oneMinus(r).max(0), 1.6)).mul(0.9);
    const lens = new MeshBasicNodeMaterial({ name: `lens-${i}` });
    lens.colorNode = color.mul(intensity).mul(3);

    const group = new Group();
    group.position.set(...p);
    const yoke = new Mesh(yokeGeometry, body);
    const head = new Group();
    const headMesh = new Mesh(headGeometry, body);
    const lensMesh = new Mesh(lensDisc, lens);
    lensMesh.position.y = -0.171;
    head.add(headMesh, lensMesh);
    const beam = new Mesh(cone, beamMaterial);
    const pool = new Mesh(disc, poolMaterial);
    group.add(yoke, head, beam);
    for (const o of [yoke, headMesh, lensMesh, beam, pool]) {
      o.raycast = () => {};
      o.frustumCulled = false;
    }
    return { group, head, beam, pool, color, intensity };
  });
}

/** The floor height at a point: the stage's top on the stage, else the gallery floor. */
function floorAt(x: number, z: number) {
  const s = GALLERY.stage;
  return x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ ? STAGE_TOP : FLOOR_Y;
}

/** Points a fixture at its cue's aim, sizes its beam to the throw and sets its pool where it lands. */
export function aimFixture(f: Fixture, cue: BeamCue) {
  target.set(cue.aim[0], floorAt(cue.aim[0], cue.aim[2]) + 0.004, cue.aim[2]);
  dir.copy(target).sub(f.group.position);
  const throwLength = dir.length();
  dir.normalize();
  f.head.quaternion.setFromUnitVectors(DOWN, dir);
  f.beam.quaternion.copy(f.head.quaternion);
  const radius = throwLength * SPREAD;
  f.beam.scale.set(radius, throwLength, radius);
  // The pool is an ellipse on the floor (the beam lands obliquely).
  f.pool.position.copy(target);
  const slant = Math.max(Math.abs(dir.y), 0.25);
  f.pool.scale.set(radius / Math.sqrt(slant), 1, radius / Math.sqrt(slant));
  f.color.value.setRGB(...cue.color);
  f.intensity.value = cue.intensity;
  const visible = cue.intensity > 0.003;
  f.beam.visible = visible;
  f.pool.visible = visible;
}
