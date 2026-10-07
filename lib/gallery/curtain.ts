import { abs, dot, normalView, oneMinus, positionViewDirection, pow, uv, vec3 } from "three/tsl";
import { DoubleSide, Group, Mesh, MeshPhysicalNodeMaterial, PlaneGeometry } from "three/webgpu";
import { FLOOR_Y, GALLERY } from "@/lib/explore/layout";
import { stageUniforms as u } from "./stage";

/**
 * The theatre's curtain: two halves of oxblood velvet, pleated, a gold fringe along the hem, in front of the stage.
 * Between performances it is closed (a warm footlight glow along its hem); it opens after the three knocks and
 * gathers to the sides (each half pivots on its outer edge and its pleats bunch), then closes after the bow.
 */

const S = GALLERY.stage;
const WIDTH = S.maxX - S.minX + 0.4;
const HEIGHT = GALLERY.truss.y - S.height - 0.15;
/** Pleat depth and count per half. */
const PLEAT = 0.07;
const PLEATS = 15;

export type Curtain = { group: Group; halves: Group[] };

export function buildCurtain(): Curtain {
  const velvet = new MeshPhysicalNodeMaterial({ name: "curtain-velvet", color: "#5a0d16", roughness: 0.9, sheen: 1, sheenRoughness: 0.45, side: DoubleSide });
  // Velvet: dark in the folds facing the eye, brighter at grazing angles; a gold fringe at the hem; the footlights'
  // glow rising from the bottom (stronger with the house lights down).
  const facing = abs(dot(normalView, positionViewDirection));
  const fringe = uv().y.lessThan(0.018).select(1, 0);
  velvet.colorNode = vec3(0.22, 0.025, 0.04).mul(pow(oneMinus(facing), 1.2).mul(1.4).add(0.35)).mul(fringe.oneMinus()).add(vec3(0.75, 0.55, 0.22).mul(fringe));
  velvet.emissiveNode = vec3(1, 0.5, 0.25).mul(pow(oneMinus(uv().y), 8)).mul(0.18).mul(oneMinus(u.house.mul(0.5)));

  const group = new Group();
  group.position.set((S.minX + S.maxX) / 2, FLOOR_Y + S.height, S.minZ + 0.12);
  const halves = [-1, 1].map((side) => {
    const half = WIDTH / 2;
    const g = new PlaneGeometry(half, HEIGHT, PLEATS * 8, 12);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(((x + half / 2) / half) * PLEATS * Math.PI * 2) * PLEAT * 0.5);
    }
    g.computeVertexNormals();
    // Each half hangs from its outer edge: the pivot.
    g.translate((-side * half) / 2, HEIGHT / 2, 0);
    const mesh = new Mesh(g, velvet);
    mesh.raycast = () => {};
    const pivot = new Group();
    pivot.position.x = (side * WIDTH) / 2;
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  });
  return { group, halves };
}

/** Opens the curtain to `open` (0 … 1): the halves gather toward their pivots, pleats bunching. */
export function setCurtain(c: Curtain, open: number) {
  const e = open * open * (3 - 2 * open);
  for (const half of c.halves) {
    half.scale.x = 1 - 0.82 * e;
    // Bunched pleats stand out further.
    half.scale.z = 1 + 1.6 * e;
  }
  c.group.visible = open < 0.999;
}
