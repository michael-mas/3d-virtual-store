import { uniform } from "three/tsl";
import { Vector3 } from "three/webgpu";
import { stageUniforms } from "./stage";

/**
 * What the visitor can do to the works (a click on the work, or the label's button): the uniforms their shaders read
 * and the small bits of motion animated on the CPU. Times are on the gallery clock (stageUniforms.clock).
 */

const RIPPLES = 3;
const never = -1000;

export const art = {
  /** Marée: the last ripples (u, v, start). */
  ripples: Array.from({ length: RIPPLES }, () => uniform(new Vector3(0.5, 0.5, never))),
  nextRipple: 0,
  /** Champ d'or: a golden wave from the touched point (u, v, start). */
  goldWave: uniform(new Vector3(0.5, 0.5, never)),
  /** Fragment: how open the cut is (0 … 1), eased toward `fragmentTarget`. */
  fragmentOpen: uniform(0),
  fragmentTarget: 0,
  fragmentCloseAt: 0,
  /** Constellation: the start of the meteor shower. */
  meteors: uniform(never),
  /** Miroir noir: the visitor's nearness (0 … 1) reveals the emblem; a touch makes it flare. */
  mirrorNear: uniform(0),
  mirrorFlare: uniform(never),
  /** Nœud: trefoil (0) … cinquefoil (1). */
  knotMorph: uniform(0),
  knotTarget: 0,
  /** Monolithe: the start of the gold flowing down the crack. */
  goldFlow: uniform(never),
  /** Équilibre: the sphere's tilt (rad, x/z) and its angular velocity. */
  wobble: { x: 0, z: 0, vx: 0, vz: 0 },
  /** Ruban: extra spin (rad/s), decaying. */
  ribbonSpin: 0,
};

const clock = () => stageUniforms.clock.value;

/** The visitor touches a work (`uv`: where, on a wall work's face, 0..1). Returns whether it reacts to touch. */
export function touchArtwork(id: string, uv: [number, number] = [0.5, 0.5]): boolean {
  const t = clock();
  switch (id) {
    case "maree": {
      art.ripples[art.nextRipple].value.set(uv[0], uv[1], t);
      art.nextRipple = (art.nextRipple + 1) % RIPPLES;
      return true;
    }
    case "champ-d-or":
      art.goldWave.value.set(uv[0], uv[1], t);
      return true;
    case "fragment":
      art.fragmentTarget = art.fragmentTarget > 0.5 ? 0 : 1;
      art.fragmentCloseAt = t + 12;
      return true;
    case "constellation":
      art.meteors.value = t;
      return true;
    case "miroir-noir":
      art.mirrorFlare.value = t;
      return true;
    case "noeud":
      art.knotTarget = art.knotTarget > 0.5 ? 0 : 1;
      return true;
    case "monolithe":
      art.goldFlow.value = t;
      return true;
    case "equilibre": {
      const a = Math.random() * Math.PI * 2;
      art.wobble.vx += Math.cos(a) * 0.9;
      art.wobble.vz += Math.sin(a) * 0.9;
      return true;
    }
    case "ruban":
      art.ribbonSpin = 7;
      return true;
    default:
      return false;
  }
}

/** Eases the interactive motion one frame. */
export function stepInteractions(dt: number) {
  const t = clock();
  if (art.fragmentTarget > 0.5 && t > art.fragmentCloseAt) art.fragmentTarget = 0;
  art.fragmentOpen.value += (art.fragmentTarget - art.fragmentOpen.value) * (1 - Math.exp(-dt * (art.fragmentTarget > 0.5 ? 1.6 : 2.4)));
  art.knotMorph.value += (art.knotTarget - art.knotMorph.value) * (1 - Math.exp(-dt * 1.2));
  // The balanced sphere: a damped pendulum back to rest.
  const w = art.wobble;
  w.vx += (-w.x * 26 - w.vx * 2.2) * dt;
  w.vz += (-w.z * 26 - w.vz * 2.2) * dt;
  w.x += w.vx * dt;
  w.z += w.vz * dt;
  art.ribbonSpin *= Math.exp(-dt * 0.8);
}
