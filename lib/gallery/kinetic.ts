import { abs, cos, exp, float, floor, instanceIndex, length, max, mix, mod, positionLocal, sin, smoothstep, step, vec2, vec3 } from "three/tsl";
import { CylinderGeometry, InstancedMesh, MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, SphereGeometry } from "three/webgpu";
import { FLOOR_Y, GALLERY } from "@/lib/explore/layout";
import { art } from "./interactions";
import { stageUniforms as u } from "./stage";

/**
 * « Pluie d'or »: a kinetic installation of brass drops hanging from the ceiling on fine wires (after the kinetic
 * sculptures of museums and airports). Their heights are computed in the vertex shader from the clock: four
 * figures that melt into one another (a travelling wave, a ripple from the center, a hanging dome, a twist), and
 * the drops part above the visitor walking beneath them, glowing as they rise; touched, a cascade of falling,
 * glowing drops spreads from the center. Two instanced draws.
 */

const { center, cols, rows, spacing } = GALLERY.rain;
export const RAIN_COUNT = cols * rows;
const CEILING = FLOOR_Y + GALLERY.height;
/** Mean height of the drops above the floor (m): well above a head. */
const BASE = 2.8;

/** The drop's place: grid position and height (TSL), and how much it is lifted by the visitor. */
function dropPlace() {
  const i = float(instanceIndex);
  const col = mod(i, cols);
  const row = floor(i.div(cols));
  const gx = col.sub((cols - 1) / 2).mul(spacing[0]).add(center[0]);
  const gz = row.sub((rows - 1) / 2).mul(spacing[1]).add(center[1]);
  const dx = gx.sub(center[0]);
  const dz = gz.sub(center[1]);
  const r = length(vec2(dx, dz));
  const t = u.clock;

  const wave = sin(dx.mul(1.4).sub(t.mul(1.2))).mul(0.32);
  const ripple = sin(r.mul(3.2).sub(t.mul(2))).mul(0.3).mul(exp(r.mul(-0.25)));
  const dome = max(float(1).sub(r.div(2.6).pow(2)), 0).mul(-0.5).add(0.15);
  const twist = sin(dx.mul(1.2).add(t.mul(0.6))).mul(cos(dz.mul(2.2).sub(t.mul(0.8)))).mul(0.35);
  // Each figure holds ~8 s, then melts into the next (weights normalized).
  const s = t.mul(0.1);
  const weight = (k: number) => smoothstep(0.85, 0.35, abs(mod(s.sub(k).add(2), 4).sub(2)));
  const [w0, w1, w2, w3] = [0, 1, 2, 3].map(weight);
  const shape = wave.mul(w0).add(ripple.mul(w1)).add(dome.mul(w2)).add(twist.mul(w3)).div(w0.add(w1).add(w2).add(w3).max(0.001));

  // The drops part above the visitor.
  const dv = length(vec2(gx, gz).sub(u.visitor));
  const lift = exp(dv.div(0.95).pow(2).negate()).mul(0.6);
  // The cascade: a ring that spreads from the center, each drop falling as it passes, then rising back.
  const age = t.sub(art.rainBurst);
  const front = r.sub(age.mul(1.3));
  const fall = exp(front.mul(front).mul(-2.2)).mul(exp(age.mul(-0.22))).mul(step(0, age));
  const y = shape.add(lift).sub(fall.mul(0.85)).add(FLOOR_Y + BASE);
  return { gx, gz, y, lift: lift.add(fall.mul(1.4)) };
}

export function buildKineticRain(): InstancedMesh[] {
  const drop = new MeshPhysicalNodeMaterial({ name: "rain-drop", color: "#d9b56e", metalness: 1, roughness: 0.12 });
  const d = dropPlace();
  drop.positionNode = positionLocal.add(vec3(d.gx, d.y, d.gz));
  drop.emissiveNode = vec3(1, 0.68, 0.3).mul(d.lift.mul(1.6).add(0.02));
  const drops = new InstancedMesh(new SphereGeometry(0.028, 16, 12).scale(1, 1.55, 1), drop, RAIN_COUNT);

  const wire = new MeshBasicNodeMaterial({ name: "rain-wire", color: "#3a352e" });
  const w = dropPlace();
  wire.positionNode = vec3(positionLocal.x.add(w.gx), mix(w.y, float(CEILING), positionLocal.y), positionLocal.z.add(w.gz));
  const wires = new InstancedMesh(new CylinderGeometry(0.0012, 0.0012, 1, 4).translate(0, 0.5, 0), wire, RAIN_COUNT);

  for (const m of [drops, wires]) {
    m.frustumCulled = false;
    m.raycast = () => {};
  }
  return [drops, wires];
}
