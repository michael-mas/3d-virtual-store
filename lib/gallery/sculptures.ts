import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import {
  BoxGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three/webgpu";

/**
 * The gallery's four sculptures, built procedurally (no model files), each standing on its plinth (local y = 0 is
 * the plinth top) and returned with the part that turns slowly, if any.
 */

export type SculptureMaterials = { polishedBrass: Material; brass: Material; knot: Material; marble: Material; basalt: Material; kintsugi: Material };
/** The sculpture, the part that turns (if any), and the part that tilts when touched (if any). */
export type Sculpture = { group: Group; spin: Group | null; tilt: Group | null; geometries: BufferGeometry[] };

/** Ruban: a Möbius band in polished brass, upright on a slim brass stem. */
function ruban(m: SculptureMaterials): Sculpture {
  const R = 0.19;
  const W = 0.11;
  const band = new ParametricGeometry(
    (u: number, v: number, target: Vector3) => {
      const a = u * Math.PI * 2;
      const s = (v - 0.5) * W;
      const r = R + s * Math.cos(a / 2);
      target.set(r * Math.cos(a), r * Math.sin(a), s * Math.sin(a / 2));
    },
    160,
    12,
  );
  const stem = new CylinderGeometry(0.008, 0.012, 0.14, 16);
  const foot = new CylinderGeometry(0.07, 0.075, 0.018, 40);
  const group = new Group();
  const spin = new Group();
  spin.position.y = 0.14 + R + 0.01;
  const bandMesh = new Mesh(band, m.polishedBrass);
  spin.add(bandMesh);
  const stemMesh = new Mesh(stem, m.brass);
  stemMesh.position.y = 0.07 + 0.018;
  const footMesh = new Mesh(foot, m.brass);
  footMesh.position.y = 0.009;
  group.add(spin, stemMesh, footMesh);
  return { group, spin, tilt: null, geometries: [band, stem, foot] };
}

/** Équilibre: a Carrara sphere resting on the tip of a brass cone, a thin brass arc around them. */
function equilibre(m: SculptureMaterials): Sculpture {
  const sphere = new SphereGeometry(0.15, 64, 40);
  const cone = new ConeGeometry(0.07, 0.24, 48);
  const arc = new TorusGeometry(0.29, 0.0045, 8, 96, Math.PI * 1.15);
  const disc = new CylinderGeometry(0.11, 0.11, 0.012, 48);
  const group = new Group();
  const coneMesh = new Mesh(cone, m.polishedBrass);
  // Point up: the tip carries the sphere.
  coneMesh.position.y = 0.012 + 0.12;
  // The sphere pivots on the cone's tip (it sways when touched).
  const tilt = new Group();
  tilt.position.y = 0.012 + 0.24;
  const sphereMesh = new Mesh(sphere, m.marble);
  sphereMesh.position.y = 0.15 - 0.004;
  tilt.add(sphereMesh);
  const arcMesh = new Mesh(arc, m.brass);
  arcMesh.position.y = 0.012 + 0.29;
  arcMesh.rotation.set(0, 0.5, -Math.PI * 0.075);
  const discMesh = new Mesh(disc, m.brass);
  discMesh.position.y = 0.006;
  group.add(coneMesh, tilt, arcMesh, discMesh);
  return { group, spin: null, tilt, geometries: [sphere, cone, arc, disc] };
}

/**
 * Nœud: a trefoil knot in mirror-polished steel, turning once a minute; touched, it reties itself as a cinquefoil
 * (the same tube with the same vertex layout, morphed in the vertex shader).
 */
function noeud(m: SculptureMaterials): Sculpture {
  const knot = new TorusKnotGeometry(0.13, 0.034, 320, 40, 2, 3);
  const cinquefoil = new TorusKnotGeometry(0.115, 0.03, 320, 40, 2, 5);
  knot.setAttribute("positionB", cinquefoil.getAttribute("position"));
  knot.setAttribute("normalB", cinquefoil.getAttribute("normal"));
  cinquefoil.dispose();
  const pin = new CylinderGeometry(0.006, 0.006, 0.12, 12);
  const group = new Group();
  const spin = new Group();
  spin.position.y = 0.12 + 0.19;
  spin.add(new Mesh(knot, m.knot));
  const pinMesh = new Mesh(pin, m.brass);
  pinMesh.position.y = 0.06 + 0.03;
  group.add(spin, pinMesh);
  return { group, spin, tilt: null, geometries: [knot, pin] };
}

/** Monolithe: a basalt slab, split and mended with a seam of gold running down its front and back. */
function monolithe(m: SculptureMaterials): Sculpture {
  const [w, h, d] = [0.3, 0.86, 0.13];
  const slab = new BoxGeometry(w, h, d, 2, 8, 2);
  // A crack's path: deterministic zigzag from the top edge to the bottom edge.
  const xs = [0.04, -0.02, 0.05, 0.01, -0.06, -0.01, 0.05, 0.02, -0.03];
  const seam = (z: number) =>
    new TubeGeometry(new CatmullRomCurve3(xs.map((x, i) => new Vector3(x, h / 2 - (i / (xs.length - 1)) * h, z))), 160, 0.0042, 6, false);
  const front = seam(d / 2 + 0.0005);
  const back = seam(-d / 2 - 0.0005);
  const group = new Group();
  const body = new Mesh(slab, m.basalt);
  body.position.y = h / 2;
  const f = new Mesh(front, m.kintsugi);
  const b = new Mesh(back, m.kintsugi);
  f.position.y = b.position.y = h / 2;
  group.add(body, f, b);
  // Slightly turned on its plinth, as if placed by hand.
  group.rotation.y = 0.35;
  return { group, spin: null, tilt: null, geometries: [slab, front, back] };
}

export const SCULPTURES: Record<"ruban" | "equilibre" | "noeud" | "monolithe", (m: SculptureMaterials) => Sculpture> = { ruban, equilibre, noeud, monolithe };
