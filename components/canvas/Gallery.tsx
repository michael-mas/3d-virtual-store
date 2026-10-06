"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { float, floor, fract, hash, mix, step, uv, vec3 } from "three/tsl";
import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, type Material } from "three/webgpu";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { isDebugEnabled } from "@/lib/debug";
import { concierge } from "@/lib/explore/concierge";
import { door, doorWanted, stepDoor } from "@/lib/explore/door";
import { DOOR_CENTER, FLOOR_Y, GALLERY } from "@/lib/explore/layout";
import { player } from "@/lib/explore/player";
import { ARTWORKS } from "@/lib/gallery/artworks";
import { createGalleryMaterials, type GalleryMaterials } from "@/lib/gallery/materials";
import { SCULPTURES } from "@/lib/gallery/sculptures";
import { isTryOnMode } from "@/lib/modes";
import { useAppStore } from "@/store/useAppStore";

/** Depth of a canvas off its wall (m), and of its shadow-gap frame. */
const CANVAS_DEPTH = 0.04;
const GAP = 0.018;
/** Door leaves: glass thickness and brass profile (m). */
const LEAF_DEPTH = 0.024;
const PROFILE = 0.04;

/** A museum label's card: ivory, with lines of "print" (a bolder title, then the notice), drawn in TSL. */
function labelMaterial(): Material {
  const m = new MeshBasicNodeMaterial({ name: "gallery-label" });
  const u = uv();
  const row = floor(u.y.mul(9));
  const inRow = fract(u.y.mul(9));
  const length = mix(0.45, 0.85, hash(row.add(3)));
  const bold = step(7, row).mul(step(row, 7));
  const ink = step(0.35, inRow).mul(step(inRow, mix(0.62, 0.8, bold))).mul(step(u.x, length)).mul(step(0.1, u.x)).mul(step(row, 7)).mul(step(2, row));
  m.colorNode = mix(vec3(0.4, 0.38, 0.34), vec3(0.06, 0.055, 0.05), ink.mul(float(0.85)));
  return m;
}

/** One glazed leaf: smoky glass in a slim brass frame, with two fine brass lines at hand height. Origin: bottom center. */
function buildLeaf(width: number, height: number, m: GalleryMaterials, geometries: BoxGeometry[]): Group {
  const box = (w: number, h: number, d: number) => {
    const g = new BoxGeometry(w, h, d);
    geometries.push(g);
    return g;
  };
  const leaf = new Group();
  const glass = new Mesh(box(width - PROFILE * 2, height - PROFILE * 2, 0.008), m.glass);
  glass.position.y = height / 2;
  leaf.add(glass);
  for (const side of [-1, 1]) {
    const stile = new Mesh(box(PROFILE, height, LEAF_DEPTH), m.doorBrass);
    stile.position.set((side * (width - PROFILE)) / 2, height / 2, 0);
    const rail = new Mesh(box(width, PROFILE * 1.4, LEAF_DEPTH), m.doorBrass);
    rail.position.y = side < 0 ? PROFILE * 0.7 : height - PROFILE * 0.7;
    leaf.add(stile, rail);
  }
  for (const y of [1.02, 1.07]) {
    const line = new Mesh(box(width - PROFILE * 2, 0.006, 0.012), m.doorBrass);
    line.position.y = y;
    leaf.add(line);
  }
  return leaf;
}

/**
 * The contemporary art gallery behind the entrance wall (its room is baked into showroom.glb): the glazed doors,
 * which slide into the wall as the visitor or the concierge comes near, six wall works and four sculptures on their
 * plinths (lib/gallery), each wall work with its museum label. The works are procedural (TSL), no textures. Hidden
 * during try-on, like the salon.
 */
export default function Gallery() {
  const hidden = useAppStore((s) => isTryOnMode(s.mode));
  const reducedMotion = useReducedMotion();

  const scene = useMemo(() => {
    const m = createGalleryMaterials();
    const geometries: BoxGeometry[] = [];
    const root = new Group();
    root.name = "gallery";

    // The doors: two leaves meeting in the middle of the doorway, inside the wall's thickness.
    const hw = GALLERY.door.halfWidth;
    const leaves = [-1, 1].map((side) => {
      const leaf = buildLeaf(hw + 0.01, GALLERY.door.height, m, geometries);
      leaf.position.set((side * hw) / 2, FLOOR_Y, DOOR_CENTER[1]);
      root.add(leaf);
      return { leaf, side };
    });

    // Wall works: canvas (the work on its face) on a recessed black frame, and a label to the right.
    const label = labelMaterial();
    const labelGeometry = new PlaneGeometry(0.15, 0.1);
    for (const a of ARTWORKS) {
      if (a.kind !== "wall") continue;
      const id = a.id as keyof GalleryMaterials["works"];
      const g = new Group();
      g.position.set(...a.center);
      g.rotation.y = Math.atan2(a.facing[0], a.facing[1]);
      const [w, h] = a.size;
      if (id === "lumiere-lente") {
        // A field of light flush with the wall, its glow spilling around it.
        const halo = new Mesh(new PlaneGeometry(w * 2.1, h * 2.3), m.halo);
        halo.position.z = 0.003;
        const field = new Mesh(new PlaneGeometry(w, h), m.works[id]);
        field.position.z = 0.006;
        g.add(halo, field);
      } else {
        const art = m.works[id];
        const frameMaterial = id === "miroir-noir" ? m.brass : m.frame;
        const canvas = new Mesh(new BoxGeometry(w, h, CANVAS_DEPTH), [m.frame, m.frame, m.frame, m.frame, art, m.frame]);
        canvas.position.z = GAP + CANVAS_DEPTH / 2 + 0.004;
        const backing = new Mesh(new BoxGeometry(w + GAP * 2, h + GAP * 2, GAP), frameMaterial);
        backing.position.z = GAP / 2 + 0.002;
        g.add(backing, canvas);
      }
      const card = new Mesh(labelGeometry, label);
      card.position.set(w / 2 + 0.22, FLOOR_Y + 1.42 - a.center[1], 0.004);
      g.add(card);
      root.add(g);
    }

    // Sculptures, on the plinths.
    const spinning: { group: Group; rate: number }[] = [];
    for (const a of ARTWORKS) {
      if (a.kind !== "sculpture") continue;
      const s = SCULPTURES[a.id as keyof typeof SCULPTURES](m);
      s.group.position.set(a.center[0], a.center[1] + 0.016, a.center[2]);
      // Each faces the aisle.
      s.group.rotation.y += Math.atan2(a.facing[0], a.facing[1]);
      root.add(s.group);
      // The knot turns once a minute, the ribbon slower.
      if (s.spin) spinning.push({ group: s.spin, rate: a.id === "noeud" ? (Math.PI * 2) / 60 : (Math.PI * 2) / 90 });
    }

    root.traverse((o) => {
      if (o instanceof Mesh) o.raycast = () => {};
    });
    // Mounted once for the app's lifetime (like the salon): its GPU resources are never disposed.
    return { root, leaves, spinning };
  }, []);

  // Debug-only handle for scripted views (screenshots of the doors).
  useEffect(() => {
    if (isDebugEnabled()) Object.assign(window, { __door: door });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (useAppStore.getState().mode === "EXPLORE" && !(door as { held?: boolean }).held) {
      stepDoor(doorWanted([player.position, concierge.position], player.path), dt);
    }
    // Eased slide into the wall pockets.
    const t = door.amount;
    const e = t * t * (3 - 2 * t);
    const hw = GALLERY.door.halfWidth;
    for (const { leaf, side } of scene.leaves) leaf.position.x = side * (hw / 2 + e * (hw + 0.04));
    if (!reducedMotion) for (const s of scene.spinning) s.group.rotation.y += s.rate * dt;
  });

  return (
    <group visible={!hidden}>
      <primitive object={scene.root} />
    </group>
  );
}
