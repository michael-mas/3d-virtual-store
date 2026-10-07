"use client";

import { useEffect, useMemo } from "react";
import {
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalNodeMaterial,
  Vector2,
  type BufferGeometry,
} from "three/webgpu";
import { LIP_FINISHES, readLipstickConfig, type LipFinish } from "@/lib/products/lipstick";
import { useLookConfig } from "@/hooks/useLookConfig";
import SurfaceProductDisplay from "./SurfaceProductDisplay";
import PedestalMount, { TINY } from "./PedestalMount";

/** Tube dimensions (meters): a classic bullet lipstick with its cap lying beside it. */
const CASE_RADIUS = 0.0125;
const CASE_HEIGHT = 0.042;
const SLEEVE_RADIUS = 0.0098;
const SLEEVE_HEIGHT = 0.016;
const BULLET_RADIUS = 0.0078;
const BULLET_HEIGHT = 0.026;
/** Slant of the bullet tip (rise per unit of width). */
const TIP_SLANT = 0.9;
/** The pedestal top is at -productOffsetY relative to the product origin (see showroom-layout.json). */
const BASE_Y = -0.024;
/** Displayed slightly larger than life so it reads from a distance, like the glasses. */
const DISPLAY_SCALE = 1.4;

function bulletGeometry(): BufferGeometry {
  // Cylinder whose top is cut at an angle (the classic slanted bullet).
  const geometry = new CylinderGeometry(BULLET_RADIUS, BULLET_RADIUS, BULLET_HEIGHT, 40, 6);
  const p = geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + BULLET_HEIGHT / 2) / BULLET_HEIGHT; // 0 bottom → 1 top
    const cut = (p.getX(i) + BULLET_RADIUS) * TIP_SLANT; // lower on the -x side
    p.setY(i, p.getY(i) - cut * t * t);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function caseGeometry(): BufferGeometry {
  // Lathe profile with a small bevel at the top and bottom edges.
  const r = CASE_RADIUS;
  const h = CASE_HEIGHT;
  const b = 0.0012;
  const profile = [
    [0, 0],
    [r - b, 0],
    [r, b],
    [r, h - b],
    [r - b, h],
    [SLEEVE_RADIUS, h],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(profile, 48);
}

function bulletMaterials(): Record<LipFinish, MeshPhysicalNodeMaterial> {
  return {
    matte: new MeshPhysicalNodeMaterial({ name: "bullet-matte", roughness: 0.85, metalness: 0 }),
    satin: new MeshPhysicalNodeMaterial({ name: "bullet-satin", roughness: 0.45, metalness: 0, sheen: 0.4 }),
    gloss: new MeshPhysicalNodeMaterial({ name: "bullet-gloss", roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }),
    metallic: new MeshPhysicalNodeMaterial({ name: "bullet-metallic", roughness: 0.3, metalness: 0.75 }),
  };
}

/**
 * Lipstick product on its pedestal: a procedural tube whose bullet shows the configured shade and finish (EXPLORE);
 * in CUSTOMIZE and in cart thumbnails the lipstick is shown on the mannequin head (SurfaceProductDisplay).
 * In try-on the product is drawn on the lips by the surface layer (SurfaceLayer + lib/tryon/surface/lipstick.ts);
 * the tube is shrunk away like every other displayed product.
 */
export default function Lipstick({ productId }: { productId: string }) {
  const config = readLipstickConfig(useLookConfig(productId));

  const parts = useMemo(() => {
    const gold = new MeshPhysicalNodeMaterial({ name: "lipstick-case", color: "#c9a44c", roughness: 0.28, metalness: 1 });
    const bullets = bulletMaterials();
    const caseGeo = caseGeometry();
    const sleeveGeo = new CylinderGeometry(SLEEVE_RADIUS, SLEEVE_RADIUS, SLEEVE_HEIGHT, 40);
    const bulletGeo = bulletGeometry();
    const capGeo = new CylinderGeometry(CASE_RADIUS + 0.0006, CASE_RADIUS + 0.0006, 0.04, 40, 1, false);

    const model = new Group();
    model.name = "lipstick";
    const caseMesh = new Mesh(caseGeo, gold);
    const sleeve = new Mesh(sleeveGeo, gold);
    sleeve.position.y = CASE_HEIGHT + SLEEVE_HEIGHT / 2;
    const bullet = new Mesh(bulletGeo, bullets.satin);
    bullet.position.y = CASE_HEIGHT + SLEEVE_HEIGHT + BULLET_HEIGHT / 2 - 0.002;
    // Cap lying on the pedestal, to the right of the tube.
    const cap = new Mesh(capGeo, gold);
    cap.rotation.set(Math.PI / 2, 0, Math.PI / 5);
    cap.position.set(0.032, CASE_RADIUS, 0.004);
    model.add(caseMesh, sleeve, bullet, cap);
    model.position.y = BASE_Y;
    model.scale.setScalar(DISPLAY_SCALE);
    for (const o of [caseMesh, sleeve, bullet, cap]) o.frustumCulled = false;

    // Keep-alive: every bullet variant drawn tiny each frame, so switching finish never compiles on the spot.
    const keepAlive = new Group();
    for (const m of Object.values(bullets)) keepAlive.add(new Mesh(bulletGeo, m));
    keepAlive.scale.setScalar(TINY);
    keepAlive.traverse((o) => (o.frustumCulled = false));

    return { model, bullet, bullets, gold, keepAlive, geometries: [caseGeo, sleeveGeo, bulletGeo, capGeo] };
  }, []);

  useEffect(
    () => () => {
      parts.geometries.forEach((g) => g.dispose());
      Object.values(parts.bullets).forEach((m) => m.dispose());
      parts.gold.dispose();
    },
    [parts],
  );

  // Live config → materials: swap the bullet material, set the shade on every variant.
  useEffect(() => {
    parts.bullet.material = parts.bullets[config.finish];
  }, [parts, config.finish]);
  useEffect(() => {
    for (const f of LIP_FINISHES) parts.bullets[f].color.set(config.color);
  }, [parts, config.color]);

  const hitBox = useMemo(
    () => ({
      size: [0.07 * DISPLAY_SCALE, 0.09 * DISPLAY_SCALE, 0.05 * DISPLAY_SCALE] as [number, number, number],
      center: [0.01, BASE_Y + 0.045 * DISPLAY_SCALE, 0] as [number, number, number],
    }),
    [],
  );

  return (
    <PedestalMount productId={productId} hitBox={hitBox}>
      <SurfaceProductDisplay productId={productId} packaging={<primitive object={parts.model} />} />
      <primitive object={parts.keepAlive} />
    </PedestalMount>
  );
}
