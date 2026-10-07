"use client";

import { useEffect, useMemo } from "react";
import { abs, hue, mix, normalView, normalize, positionLocal, time, uniform, vec3 } from "three/tsl";
import {
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalNodeMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three/webgpu";
import { readFacePaintConfig, type FacePaintStyle } from "@/lib/products/facePaint";
import { useLookConfig } from "@/hooks/useLookConfig";
import SurfaceProductDisplay from "./SurfaceProductDisplay";
import PedestalMount from "./PedestalMount";

/** Jar dimensions (meters). */
const JAR_RADIUS = 0.028;
const JAR_HEIGHT = 0.03;
const WALL = 0.0025;
const BASE_Y = -0.024;
const DISPLAY_SCALE = 1.3;
/** The jar leans toward the viewer so the paint surface is visible from the customizer camera (nearly level). */
const TILT = 0.6;

const STYLE_WEIGHTS: Record<FacePaintStyle, [number, number, number]> = {
  paint: [1, 0, 0],
  neon: [0, 1, 0],
  holographic: [0, 0, 1],
};

function jarGeometry() {
  const r = JAR_RADIUS;
  const h = JAR_HEIGHT;
  const profile = [
    [0, 0],
    [r - 0.002, 0],
    [r, 0.002],
    [r, h],
    [r - WALL, h],
    [r - WALL, WALL],
    [0, WALL],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(profile, 48);
}

/**
 * Face paint product on its pedestal: an open jar whose paint surface shows the configured color and style
 * (plain paint, emissive neon, or a view-dependent holographic rainbow — one node material, uniforms only),
 * with its lid leaning beside it (EXPLORE). In CUSTOMIZE and cart thumbnails the design is shown on the mannequin
 * head (SurfaceProductDisplay). In try-on the design is drawn on the face by the surface layer
 * (SurfaceLayer + lib/tryon/surface/facePaint.ts).
 */
export default function FacePaint({ productId }: { productId: string }) {
  const config = readFacePaintConfig(useLookConfig(productId));

  const parts = useMemo(() => {
    const color = uniform(new Color("#22d3ee"));
    const weights = uniform(new Vector3(0, 1, 0));
    const paint = new MeshPhysicalNodeMaterial({ name: "face-paint-jar-paint", roughness: 0.35, metalness: 0 });
    const facing = abs(normalize(normalView).z);
    const rainbow = hue(vec3(1, 0.2, 0.2), facing.mul(4).add(positionLocal.x.mul(90)).add(time.mul(0.6)));
    paint.colorNode = mix(color, vec3(0.8, 0.82, 0.86), weights.z);
    paint.emissiveNode = color.mul(weights.y.mul(1.6)).add(rainbow.mul(weights.z.mul(0.7)));
    paint.metalnessNode = weights.z.mul(0.6);

    const ceramic = new MeshPhysicalNodeMaterial({ name: "face-paint-jar", color: "#141210", roughness: 0.3, clearcoat: 1 });
    const jarGeo = jarGeometry();
    const paintGeo = new CylinderGeometry(JAR_RADIUS - WALL, JAR_RADIUS - WALL, 0.001, 48);
    const lidGeo = new CylinderGeometry(JAR_RADIUS + 0.001, JAR_RADIUS + 0.001, 0.012, 48);
    const rimGeo = new TorusGeometry(JAR_RADIUS + 0.001, 0.0012, 8, 48);

    const model = new Group();
    model.name = "face-paint";
    const jar = new Mesh(jarGeo, ceramic);
    const surface = new Mesh(paintGeo, paint);
    surface.position.y = JAR_HEIGHT - 0.004;
    const lid = new Mesh(lidGeo, ceramic);
    lid.rotation.set(0, 0, -1.2);
    lid.position.set(0.05, 0.026, -0.012);
    const rim = new Mesh(rimGeo, paint);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.006;
    lid.add(rim);
    const tilted = new Group();
    tilted.add(jar, surface);
    tilted.rotation.x = TILT;
    // Keep the lowest rim point on the pedestal after tilting.
    tilted.position.set(0, JAR_RADIUS * Math.sin(TILT), -JAR_RADIUS * (1 - Math.cos(TILT)));
    model.add(tilted, lid);
    model.position.y = BASE_Y;
    model.scale.setScalar(DISPLAY_SCALE);
    model.traverse((o) => (o.frustumCulled = false));

    return { model, color, weights, materials: [paint, ceramic], geometries: [jarGeo, paintGeo, lidGeo, rimGeo] };
  }, []);

  useEffect(
    () => () => {
      parts.geometries.forEach((g) => g.dispose());
      parts.materials.forEach((m) => m.dispose());
    },
    [parts],
  );

  useEffect(() => {
    parts.color.value.set(config.color);
    parts.weights.value.set(...STYLE_WEIGHTS[config.style]);
  }, [parts, config.color, config.style]);

  const hitBox = useMemo(
    () => ({
      size: [0.13 * DISPLAY_SCALE, 0.07 * DISPLAY_SCALE, 0.09 * DISPLAY_SCALE] as [number, number, number],
      center: [0.015, BASE_Y + 0.025 * DISPLAY_SCALE, 0] as [number, number, number],
    }),
    [],
  );

  return (
    <PedestalMount productId={productId} hitBox={hitBox}>
      <SurfaceProductDisplay productId={productId} packaging={<primitive object={parts.model} />} />
    </PedestalMount>
  );
}
