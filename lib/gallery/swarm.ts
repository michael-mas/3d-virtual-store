import { cos, float, fract, hash, instanceIndex, mix, positionLocal, sin, vec3 } from "three/tsl";
import { AdditiveBlending, IcosahedronGeometry, InstancedMesh, MeshBasicNodeMaterial } from "three/webgpu";
import { STAGE_CENTER, STAGE_TOP } from "./show";
import { stageUniforms as u } from "./stage";

/**
 * « Nuée »: a swarm of light above the stage. Stateless: every mote's place is a function of its index and the
 * clock, computed in the vertex shader (TSL), as a blend of five formations the show's cues weigh (a drifting
 * cloud, a ring around the automatons, a double helix, a sphere, a golden rain), plus a pull toward an attractor
 * (the conducting automaton's hand). No simulation on the CPU, one draw call.
 */

export const SWARM_COUNT = 1400;

export function buildSwarm(): InstancedMesh {
  const material = new MeshBasicNodeMaterial({ name: "swarm", transparent: true, depthWrite: false, blending: AdditiveBlending });
  const i = float(instanceIndex);
  const h1 = hash(i.add(1));
  const h2 = hash(i.add(7919));
  const h3 = hash(i.add(104729));
  const h4 = hash(i.add(31337));
  const t = u.swarmClock;
  const [cx, , cz] = STAGE_CENTER;
  const tau = Math.PI * 2;

  // Cloud: drifting motes filling the space above the stage.
  const cloud = vec3(
    h1.sub(0.5).mul(6).add(sin(t.mul(0.21).add(h2.mul(tau))).mul(0.35)).add(cx),
    h2.mul(2.8).add(STAGE_TOP + 0.4).add(sin(t.mul(0.33).add(h3.mul(tau))).mul(0.25)),
    h3.sub(0.5).mul(3.2).add(cos(t.mul(0.17).add(h1.mul(tau))).mul(0.3)).add(cz),
  );
  // Ring: a wide orbit around the three automatons.
  const a = h1.mul(tau).add(t.mul(h2.mul(0.4).add(0.35)));
  const ringR = h3.sub(0.5).mul(0.35).add(2.4);
  const ring = vec3(cos(a).mul(ringR).add(cx), sin(a.mul(3).add(t)).mul(0.12).add(h4.sub(0.5).mul(0.25)).add(STAGE_TOP + 1.3), sin(a).mul(ringR).mul(0.55).add(cz));
  // Helix: two strands rising around the center.
  const k = h1;
  const strand = h2.greaterThan(0.5).select(float(Math.PI), float(0));
  const ha = k.mul(16).add(t.mul(1.1)).add(strand);
  const helix = vec3(cos(ha).mul(0.75).add(cx), k.mul(3.1).add(STAGE_TOP + 0.2), sin(ha).mul(0.75).add(cz - 0.1));
  // Sphere: a turning globe of light at mid height.
  const theta = h1.mul(tau).add(t.mul(0.6));
  const phi = h2.mul(2).sub(1).acos();
  const sr = h4.mul(0.08).add(1.05);
  const sphere = vec3(sin(phi).mul(cos(theta)).mul(sr).add(cx), cos(phi).mul(sr).add(STAGE_TOP + 1.9), sin(phi).mul(sin(theta)).mul(sr).add(cz));
  // Rain: falling gold across the stage.
  const rain = vec3(h1.sub(0.5).mul(6.4).add(cx), float(STAGE_TOP + 3.6).sub(fract(h2.add(t.mul(h3.mul(0.25).add(0.2)))).mul(3.6)), h3.sub(0.5).mul(3.6).add(cz));

  const w = u.swarmWeights;
  const total = w.x.add(w.y).add(w.z).add(w.w).add(u.swarmRain).max(0.0001);
  const formed = cloud.mul(w.x).add(ring.mul(w.y)).add(helix.mul(w.z)).add(sphere.mul(w.w)).add(rain.mul(u.swarmRain)).div(total);
  // The pull toward the attractor: each mote at its own delay, orbiting it closely.
  const pull = u.swarmAttract.mul(h4.mul(0.6).add(0.4));
  const oa = h1.mul(tau).add(t.mul(h3.mul(2).add(1.5)));
  const orbit = vec3(cos(oa), sin(oa.mul(1.3)), sin(oa)).mul(h2.mul(0.35).add(0.05));
  const place = mix(formed, u.swarmAttractor.add(orbit), pull);

  const size = h3.mul(0.9).add(0.4);
  material.positionNode = positionLocal.mul(size).add(place);
  const twinkle = sin(t.mul(h2.mul(5).add(1)).add(h1.mul(40))).mul(0.35).add(0.75);
  material.colorNode = u.swarmColor.mul(u.swarmIntensity).mul(twinkle).mul(1.8);

  const mesh = new InstancedMesh(new IcosahedronGeometry(0.011, 0), material, SWARM_COUNT);
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return mesh;
}
