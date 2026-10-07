"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { float, mix, sin, texture, uniform, vec3 } from "three/tsl";
import { AdditiveBlending, BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RingGeometry, SRGBColorSpace, type Material, type WebGPURenderer } from "three/webgpu";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { isDebugEnabled } from "@/lib/debug";
import { concierge } from "@/lib/explore/concierge";
import { door, DOOR_SENSOR, doorWanted, stepDoor } from "@/lib/explore/door";
import { DOOR_CENTER, FLOOR_Y, GALLERY } from "@/lib/explore/layout";
import { player } from "@/lib/explore/player";
import { ARTWORKS, inGallery, type Artwork } from "@/lib/gallery/artworks";
import { art, stepInteractions, touchArtwork } from "@/lib/gallery/interactions";
import { buildKineticRain } from "@/lib/gallery/kinetic";
import { buildLivingMirror, reflectionLent, stepLivingMirror, withdrawReflection } from "@/lib/gallery/livingMirror";
import { createGalleryMaterials, type GalleryMaterials, type WallWorkId } from "@/lib/gallery/materials";
import { SCULPTURES, type Sculpture } from "@/lib/gallery/sculptures";
import { show, stageUniforms } from "@/lib/gallery/stage";
import { isTryOnMode } from "@/lib/modes";
import { useAppStore } from "@/store/useAppStore";
import Theatre from "./Theatre";

/** Depth of a canvas off its wall (m), and of its shadow-gap frame. */
const CANVAS_DEPTH = 0.04;
const GAP = 0.018;
/** Door leaves: glass thickness and brass profile (m). */
const LEAF_DEPTH = 0.024;
const PROFILE = 0.04;
/** The gallery clock's origin (seconds, performance.now), when this chunk loads. */
const CLOCK_START = performance.now() / 1000;
/** Pointer travel (px) above which a click is a camera drag. */
const DRAG_THRESHOLD = 6;

/** A museum label's card: ivory, printed with the work's title, artist and year (drawn once in a canvas). */
function labelMaterial(a: Artwork): Material {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 340;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#d9d1c1";
  ctx.fillRect(0, 0, 512, 340);
  ctx.fillStyle = "#1a1714";
  ctx.font = 'italic 46px Georgia, "Times New Roman", serif';
  ctx.fillText(a.title, 36, 96, 440);
  ctx.font = '30px Georgia, "Times New Roman", serif';
  ctx.fillText(`${a.artist}, ${a.year}`, 36, 158, 440);
  ctx.fillStyle = "#7a6a52";
  ctx.font = "22px Georgia, serif";
  ctx.fillText("MAISON PRISMA AURUM", 36, 292);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  const m = new MeshBasicNodeMaterial({ name: "gallery-label" });
  m.colorNode = texture(map).rgb.mul(0.62).mul(stageUniforms.house.mul(0.8).add(0.2));
  return m;
}

/** One glazed leaf: smoky glass in a slim brass frame, with two fine brass lines at hand height. Origin: bottom center. */
function buildLeaf(width: number, height: number, m: GalleryMaterials): Group {
  const leaf = new Group();
  const glass = new Mesh(new BoxGeometry(width - PROFILE * 2, height - PROFILE * 2, 0.008), m.glass);
  glass.position.y = height / 2;
  leaf.add(glass);
  for (const side of [-1, 1]) {
    const stile = new Mesh(new BoxGeometry(PROFILE, height, LEAF_DEPTH), m.doorBrass);
    stile.position.set((side * (width - PROFILE)) / 2, height / 2, 0);
    const rail = new Mesh(new BoxGeometry(width, PROFILE * 1.4, LEAF_DEPTH), m.doorBrass);
    rail.position.y = side < 0 ? PROFILE * 0.7 : height - PROFILE * 0.7;
    leaf.add(stile, rail);
  }
  for (const y of [1.02, 1.07]) {
    const line = new Mesh(new BoxGeometry(width - PROFILE * 2, 0.006, 0.012), m.doorBrass);
    line.position.y = y;
    leaf.add(line);
  }
  return leaf;
}

const yawOf = (a: Artwork) => Math.atan2(a.facing[0], a.facing[1]);

/** Touch targets: an invisible panel over each touchable wall work, a column around each sculpture. */
function TouchTargets() {
  const setCursor = (on: boolean) => {
    document.body.style.cursor = on ? "pointer" : "";
  };
  const touch = (a: Artwork) => (e: ThreeEvent<MouseEvent>) => {
    if (useAppStore.getState().mode !== "EXPLORE" || e.delta > DRAG_THRESHOLD) return;
    e.stopPropagation();
    touchArtwork(a.id, e.uv ? [e.uv.x, e.uv.y] : undefined);
  };
  const handlers = (a: Artwork) => ({
    onClick: touch(a),
    onPointerOver: () => setCursor(true),
    onPointerOut: () => setCursor(false),
  });
  return (
    <>
      {ARTWORKS.filter((a) => a.gesture && a.kind === "wall").map((a) => (
        <mesh
          key={a.id}
          visible={false}
          position={[a.center[0] + a.facing[0] * 0.07, a.center[1], a.center[2] + a.facing[1] * 0.07]}
          rotation={[0, yawOf(a), 0]}
          {...handlers(a)}
        >
          <planeGeometry args={a.size} />
        </mesh>
      ))}
      {ARTWORKS.filter((a) => a.kind === "sculpture").map((a) => (
        <mesh key={a.id} visible={false} position={[a.center[0], a.center[1] + 0.45, a.center[2]]} {...handlers(a)}>
          <cylinderGeometry args={[0.32, 0.32, 0.9, 12]} />
        </mesh>
      ))}
    </>
  );
}

/**
 * The contemporary art gallery behind the entrance wall (its room is baked into showroom.glb): the glazed doors,
 * which slide into the wall as the visitor or the concierge comes near (and close for the performance); five wall
 * works and four sculptures that answer a touch (lib/gallery/interactions.ts), each wall work with its label; the
 * kinetic rain of gold; and at the back, the theatre (Theatre.tsx) with its cyclorama. All procedural (TSL), no
 * textures. Compiled before it is first shown, so walking in never stalls; drawn only when it can be seen.
 */
export default function Gallery() {
  const hidden = useAppStore((s) => isTryOnMode(s.mode));
  const reducedMotion = useReducedMotion();
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const camera = useThree((s) => s.camera);
  const sceneRoot = useThree((s) => s.scene);
  const [compiled, setCompiled] = useState(false);

  const scene = useMemo(() => {
    const m = createGalleryMaterials();
    const root = new Group();
    root.name = "gallery";

    // The doors: two leaves meeting in the middle of the doorway, inside the wall's thickness.
    const hw = GALLERY.door.halfWidth;
    const leaves = [-1, 1].map((side) => {
      const leaf = buildLeaf(hw + 0.01, GALLERY.door.height, m);
      leaf.position.set((side * hw) / 2, FLOOR_Y, DOOR_CENTER[1]);
      return { leaf, side };
    });

    const content = new Group();
    root.add(content);

    // Wall works: canvas (the work on its face) on a recessed frame, and a label to the right.
    const labelGeometry = new PlaneGeometry(0.15, 0.1);
    for (const a of ARTWORKS) {
      if (a.kind !== "wall") continue;
      const g = new Group();
      g.position.set(...a.center);
      g.rotation.y = yawOf(a);
      const [w, h] = a.size;
      if (a.id === "miroir-vivant") {
        // The tiles on a black panel in a brass frame.
        const backing = new Mesh(new BoxGeometry(w + 0.12, h + 0.12, 0.02), m.brass);
        backing.position.z = 0.01;
        const panel = new Mesh(new BoxGeometry(w + 0.06, h + 0.06, 0.012), m.frame);
        panel.position.z = 0.024;
        const tiles = buildLivingMirror(w, h);
        tiles.position.z = 0.03;
        g.add(backing, panel, tiles);
        content.add(g);
        continue;
      }
      const id = a.id as WallWorkId;
      const canvas = new Mesh(new BoxGeometry(w, h, CANVAS_DEPTH), [m.frame, m.frame, m.frame, m.frame, m.works[id], m.frame]);
      canvas.position.z = GAP + CANVAS_DEPTH / 2 + 0.004;
      const backing = new Mesh(new BoxGeometry(w + GAP * 2, h + GAP * 2, GAP), id === "miroir-noir" ? m.brass : m.frame);
      backing.position.z = GAP / 2 + 0.002;
      const card = new Mesh(labelGeometry, labelMaterial(a));
      card.position.set(w / 2 + 0.22, FLOOR_Y + 1.42 - a.center[1], 0.004);
      g.add(backing, canvas, card);
      content.add(g);
    }

    // The theatre's cyclorama on the back wall: Lumière lente, its glow spilling around it.
    const cy = GALLERY.cyclorama;
    const cyclo = new Group();
    cyclo.position.set(0, FLOOR_Y + cy.centerY, GALLERY.zEnd);
    cyclo.rotation.y = Math.PI;
    const halo = new Mesh(new PlaneGeometry(cy.width * 1.5, cy.height * 1.7), m.halo);
    halo.position.z = 0.003;
    const field = new Mesh(new PlaneGeometry(cy.width, cy.height), m.cyclorama);
    field.position.z = 0.006;
    cyclo.add(halo, field);
    content.add(cyclo);

    // The stage's front edge: a line of light.
    const s = GALLERY.stage;
    const edge = new Mesh(new BoxGeometry(s.maxX - s.minX, 0.012, 0.012), m.stage);
    edge.position.set((s.minX + s.maxX) / 2, FLOOR_Y + s.height - 0.03, s.minZ - 0.004);
    content.add(edge);

    // Sculptures, on the plinths.
    const sculptures: Partial<Record<string, Sculpture>> = {};
    for (const a of ARTWORKS) {
      if (a.kind !== "sculpture") continue;
      const sc = SCULPTURES[a.id as keyof typeof SCULPTURES](m);
      sc.group.position.set(a.center[0], a.center[1] + 0.016, a.center[2]);
      sc.group.rotation.y += yawOf(a);
      content.add(sc.group);
      sculptures[a.id] = sc;
    }

    // Pluie d'or.
    content.add(...buildKineticRain());

    // A gold ring on the floor before each work, where to stand: it breathes until the work is stamped in the
    // passport, and brightens as the visitor steps in.
    const rings = ARTWORKS.map((a) => {
      const near = uniform(0);
      const stamped = uniform(0);
      const material = new MeshBasicNodeMaterial({ name: "work-ring", transparent: true, depthWrite: false, blending: AdditiveBlending });
      const breath = sin(stageUniforms.clock.mul(2.2)).mul(0.5).add(0.5);
      material.colorNode = vec3(1, 0.74, 0.36).mul(mix(breath.mul(0.25).add(0.12), float(0.08), stamped).add(near.mul(0.5))).mul(stageUniforms.house);
      const r = a.kind === "sculpture" ? 0.62 : a.kind === "installation" ? 1.1 : 0.42;
      const ring = new Mesh(new RingGeometry(r, r + 0.025, 64).rotateX(-Math.PI / 2), material);
      ring.position.set(a.viewpoint[0], FLOOR_Y + 0.004, a.viewpoint[1]);
      content.add(ring);
      return { id: a.id, near, stamped };
    });

    root.add(...leaves.map((l) => l.leaf));
    root.traverse((o) => {
      if (o instanceof Mesh) o.raycast = () => {};
    });
    // Mounted once for the app's lifetime (like the salon): its GPU resources are never disposed.
    return { root, content, leaves, sculptures, rings };
  }, []);

  // Compile every material in the background before the gallery joins the scene (no stall when it first shows).
  useEffect(() => {
    let cancelled = false;
    gl.compileAsync(scene.root, camera, sceneRoot)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCompiled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [gl, camera, sceneRoot, scene]);

  useEffect(() => {
    if (isDebugEnabled()) Object.assign(window, { __door: door, __touch: touchArtwork, __art: art });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const u = stageUniforms;
    u.clock.value = performance.now() / 1000 - CLOCK_START;
    u.visitor.value.set(player.position[0], player.position[1]);
    const explore = useAppStore.getState().mode === "EXPLORE";
    // The doors open for whoever comes near; during the performance, only for the visitor (they close behind them).
    if (explore && !(door as { held?: boolean }).held) {
      stepDoor(doorWanted(show.playing ? [player.position] : [player.position, concierge.position], player.path), dt);
    }
    const t = door.amount;
    const e = t * t * (3 - 2 * t);
    const hw = GALLERY.door.halfWidth;
    for (const { leaf, side } of scene.leaves) leaf.position.x = side * (hw / 2 + e * (hw + 0.04));

    // Drawn only when it can be seen: open doors, the visitor inside or near the glass (and compiled).
    const nearGlass = Math.hypot(player.position[0] - DOOR_CENTER[0], player.position[1] - DOOR_CENTER[1]) < DOOR_SENSOR + 2.5;
    scene.content.visible = door.amount > 0.01 || inGallery(player.position) || nearGlass;

    const { nearArtwork, stamps } = useAppStore.getState();
    for (const r of scene.rings) {
      r.near.value += ((nearArtwork === r.id ? 1 : 0) - r.near.value) * (1 - Math.exp(-dt * 6));
      r.stamped.value = stamps.includes(r.id) ? 1 : 0;
    }
    // Interactions: the mirror's emblem surfaces with nearness; the sphere sways; the ribbon and knot turn.
    const mirror = ARTWORKS.find((a) => a.id === "miroir-noir")!;
    const dm = Math.hypot(player.position[0] - mirror.viewpoint[0], player.position[1] - mirror.viewpoint[1]);
    art.mirrorNear.value = Math.max(0, Math.min(1, (2.6 - dm) / 1.6));
    stepInteractions(dt);
    // The living mirror's camera stops as soon as the visitor walks away from it (or leaves the gallery's view).
    stepLivingMirror(dt);
    if (reflectionLent()) {
      const lm = ARTWORKS.find((a) => a.id === "miroir-vivant")!;
      const away = Math.hypot(player.position[0] - lm.viewpoint[0], player.position[1] - lm.viewpoint[1]) > 3.2;
      if (away || !explore) withdrawReflection();
    }
    const { ruban, noeud, equilibre } = scene.sculptures;
    const still = reducedMotion ? 0 : 1;
    if (ruban?.spin) ruban.spin.rotation.y += ((Math.PI * 2) / 90 + art.ribbonSpin) * dt * still;
    if (noeud?.spin) noeud.spin.rotation.y += ((Math.PI * 2) / 60) * dt * still;
    if (equilibre?.tilt) equilibre.tilt.rotation.set(art.wobble.x, 0, art.wobble.z);
  });

  return (
    <group visible={!hidden}>
      {compiled && <primitive object={scene.root} />}
      <TouchTargets />
      <Theatre />
    </group>
  );
}
