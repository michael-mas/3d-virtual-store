"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalNodeMaterial,
  Path,
  Shape,
  TorusGeometry,
  type BufferGeometry,
} from "three/webgpu";
import { setProductModel } from "@/lib/cart/registry";
import { wornProductIds } from "@/lib/cart/look";
import { isTryOnMode } from "@/lib/modes";
import { readWatchConfig, type WatchCase, type WatchStrap } from "@/lib/products/watch";
import { useAppStore } from "@/store/useAppStore";
import { useLookConfig } from "@/hooks/useLookConfig";
import { depthOnlyMaterial, restOnPedestal } from "./displayHelpers";
import HandAnchor from "./HandAnchor";
import PedestalMount from "./PedestalMount";

// Model space (meters, for a NOMINAL_PALM_WIDTH_M hand): X across the wrist, Y out of the back of the wrist,
// Z toward the fingers (lib/tryon/handPose.ts wristPose). The strap is an elliptical band around Z.
const STRAP_A = 0.031;
const STRAP_B = 0.0225;
const STRAP_WIDTH = 0.02;
const STRAP_T = 0.0025;
const CASE_R = 0.0195;
const CASE_H = 0.0095;
const CASE_Y = STRAP_B + CASE_H / 2;
const DIAL_Y = CASE_Y + CASE_H / 2 + 0.0002;
/** Shown larger than life on the pedestal, like the other small products. */
const DISPLAY_SCALE = 1.6;
/** On the pedestal: forearm axis across (model Z → world X), dial tilted toward the viewer. */
const DISPLAY_ROTATION = [0.95, Math.PI / 2, 0] as const;

const CASE_LOOK: Record<WatchCase, { color: string; metalness: number; roughness: number }> = {
  steel: { color: "#c9ccd1", metalness: 1, roughness: 0.22 },
  gold: { color: "#d4af37", metalness: 1, roughness: 0.2 },
  black: { color: "#1c1c1f", metalness: 0.6, roughness: 0.35 },
};
/** Strap looks; the metal bracelet takes the case's metal. */
const STRAP_LOOK: Record<WatchStrap, { color: string | null; metalness: number; roughness: number }> = {
  "brown-leather": { color: "#6b3e26", metalness: 0, roughness: 0.72 },
  "black-leather": { color: "#1a1a1a", metalness: 0, roughness: 0.68 },
  steel: { color: null, metalness: 1, roughness: 0.3 },
  "blue-rubber": { color: "#1d3557", metalness: 0, roughness: 0.9 },
};

const ellipse = (a: number, b: number, path: Path) => path.absellipse(0, 0, a, b, 0, Math.PI * 2, false, 0);

/** Elliptical band around Z (an annulus extruded along Z), centered on z = 0, softly beveled. */
function ellipticBand(a: number, b: number, width: number, thickness: number): BufferGeometry {
  const shape = ellipse(a + thickness / 2, b + thickness / 2, new Shape()) as Shape;
  shape.holes.push(ellipse(a - thickness / 2, b - thickness / 2, new Path()));
  const bevel = thickness * 0.3;
  const geometry = new ExtrudeGeometry(shape, {
    depth: width - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.6,
    bevelSegments: 2,
    curveSegments: 96,
  });
  geometry.translate(0, 0, -(width - 2 * bevel) / 2);
  return geometry;
}

/** A watch hand from the center toward 12 o'clock (+X), in a group that turns about the dial axis. */
function watchHand(length: number, width: number, y: number, material: MeshPhysicalNodeMaterial) {
  const geometry = new BoxGeometry(length, 0.0004, width);
  geometry.translate(length / 2 - 0.0015, y, 0);
  const pivot = new Group();
  pivot.add(new Mesh(geometry, material));
  return { pivot, geometry };
}

/**
 * Watch on its pedestal (a cushion inside the strap) in EXPLORE and CUSTOMIZE, on the wrist in try-on: the same
 * model, re-parented into a HandAnchor. Everything is procedural; options only change colors and roughness, so no
 * shader is rebuilt. The hands show the current time.
 */
export default function Watch({ productId }: { productId: string }) {
  const config = readWatchConfig(useLookConfig(productId));
  const mode = useAppStore((s) => s.mode);
  const worn = useAppStore((s) => wornProductIds(s).includes(productId));

  const parts = useMemo(() => {
    const caseMat = new MeshPhysicalNodeMaterial({ name: "watch-case", metalness: 1, roughness: 0.22 });
    const dialMat = new MeshPhysicalNodeMaterial({ name: "watch-dial", roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.03 });
    const inkMat = new MeshPhysicalNodeMaterial({ name: "watch-ink", metalness: 0.7, roughness: 0.3 });
    const secondMat = new MeshPhysicalNodeMaterial({ name: "watch-second", color: "#d62828", roughness: 0.4 });
    const strapMat = new MeshPhysicalNodeMaterial({ name: "watch-strap", roughness: 0.7 });
    const cushionMat = new MeshPhysicalNodeMaterial({ name: "watch-cushion", color: "#1b1815", roughness: 0.95, sheen: 1, sheenColor: "#6b5a44" });
    const occluderMat = depthOnlyMaterial("wrist-occluder");

    const geometries: BufferGeometry[] = [];
    const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
    const model = new Group();
    model.name = "watch";

    model.add(new Mesh(keep(ellipticBand(STRAP_A, STRAP_B, STRAP_WIDTH, STRAP_T)), strapMat));
    const body = new Mesh(keep(new CylinderGeometry(CASE_R, CASE_R * 1.03, CASE_H, 64)), caseMat);
    body.position.y = CASE_Y;
    const bezel = new Mesh(keep(new TorusGeometry(CASE_R * 0.94, 0.0013, 12, 64)), caseMat);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.y = CASE_Y + CASE_H / 2 - 0.0004;
    const dial = new Mesh(keep(new CylinderGeometry(CASE_R * 0.86, CASE_R * 0.86, 0.0006, 64)), dialMat);
    dial.position.y = DIAL_Y;
    // Lugs at 12 and 6 o'clock (±X, where the strap leaves the case), crown at 3 o'clock (+Z, toward the hand).
    const lugGeo = keep(new BoxGeometry(0.0045, 0.0032, 0.0026));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const lug = new Mesh(lugGeo, caseMat);
        lug.position.set(sx * (CASE_R + 0.0012), CASE_Y - 0.0018, sz * 0.0078);
        model.add(lug);
      }
    }
    const crown = new Mesh(keep(new CylinderGeometry(0.0019, 0.0019, 0.0032, 20)), caseMat);
    crown.rotation.x = Math.PI / 2;
    crown.position.set(0, CASE_Y, CASE_R + 0.0014);
    model.add(body, bezel, dial, crown);

    // Hour markers (longer at 12, 3, 6, 9) and hands.
    for (let h = 0; h < 12; h++) {
      const major = h % 3 === 0;
      const marker = new Mesh(keep(new BoxGeometry(major ? 0.0034 : 0.0022, 0.0003, major ? 0.0012 : 0.0008)), inkMat);
      const angle = (h / 12) * Math.PI * 2;
      // Clockwise seen from above the dial: 12 o'clock +X, 3 o'clock +Z.
      marker.position.set(Math.cos(angle) * 0.0133, DIAL_Y + 0.0004, Math.sin(angle) * 0.0133);
      marker.rotation.y = -angle;
      model.add(marker);
    }
    const hour = watchHand(0.0095, 0.0014, DIAL_Y + 0.0006, inkMat);
    const minute = watchHand(0.0135, 0.001, DIAL_Y + 0.0009, inkMat);
    const second = watchHand(0.015, 0.0004, DIAL_Y + 0.0012, secondMat);
    geometries.push(hour.geometry, minute.geometry, second.geometry);
    model.add(hour.pivot, minute.pivot, second.pivot);
    model.traverse((o) => (o.frustumCulled = false));

    // Pedestal display: lying on a cushion that fills the strap (the bevel grows the shape by bevelSize).
    const CUSHION_BEVEL = 0.003;
    const cushionGeo = keep(
      new ExtrudeGeometry(
        ellipse(STRAP_A - STRAP_T / 2 - CUSHION_BEVEL, STRAP_B - STRAP_T / 2 - CUSHION_BEVEL, new Shape()) as Shape,
        { depth: 0.05, bevelEnabled: true, bevelThickness: 0.004, bevelSize: CUSHION_BEVEL, curveSegments: 64 },
      ),
    );
    cushionGeo.translate(0, 0, -0.025);
    const cushion = new Mesh(cushionGeo, cushionMat);
    // Measured on a throwaway copy laid out like the JSX display below.
    const measure = new Group();
    measure.scale.setScalar(DISPLAY_SCALE);
    const measureTilt = new Group();
    measureTilt.rotation.set(...DISPLAY_ROTATION);
    measureTilt.add(model.clone(), cushion.clone());
    measure.add(measureTilt);
    const { lift, hitBox } = restOnPedestal(measure);

    // Try-on: the wrist, slightly inside the strap, so the back of the strap hides behind it.
    const occluderGeo = keep(
      new ExtrudeGeometry(ellipse(STRAP_A - STRAP_T, STRAP_B - STRAP_T, new Shape()) as Shape, { depth: 0.16, bevelEnabled: false, curveSegments: 48 }),
    );
    occluderGeo.translate(0, 0, -0.13);
    const occluder = new Mesh(occluderGeo, occluderMat);
    occluder.renderOrder = -1;
    occluder.frustumCulled = false;

    return {
      model,
      cushion,
      lift,
      hitBox,
      occluder,
      hands: { hour: hour.pivot, minute: minute.pivot, second: second.pivot },
      materials: { caseMat, dialMat, inkMat, secondMat, strapMat, cushionMat, occluderMat },
      geometries,
    };
  }, []);

  useEffect(
    () => () => {
      parts.geometries.forEach((g) => g.dispose());
      Object.values(parts.materials).forEach((m) => m.dispose());
    },
    [parts],
  );

  // Live config → materials (colors and numbers only: no shader rebuild).
  useEffect(() => {
    const { caseMat, dialMat, inkMat, strapMat } = parts.materials;
    const metal = CASE_LOOK[config.case];
    caseMat.color.set(metal.color);
    caseMat.metalness = metal.metalness;
    caseMat.roughness = metal.roughness;
    dialMat.color.set(config.dial);
    // Light markers and hands on a dark dial, dark on a light one.
    const dial = new Color(config.dial);
    inkMat.color.set(dial.r * 0.299 + dial.g * 0.587 + dial.b * 0.114 > 0.45 ? "#1d1d1f" : "#f5f5f0");
    const strap = STRAP_LOOK[config.strap];
    strapMat.color.set(strap.color ?? metal.color);
    strapMat.metalness = strap.metalness;
    strapMat.roughness = strap.roughness;
  }, [parts, config.case, config.dial, config.strap]);

  // The hands show the local time (clockwise seen from above the dial = negative turn about +Y).
  useFrame(() => {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    parts.hands.second.rotation.y = -(s / 60) * Math.PI * 2;
    parts.hands.minute.rotation.y = -(m / 60) * Math.PI * 2;
    parts.hands.hour.rotation.y = -(h / 12) * Math.PI * 2;
  });

  if (isTryOnMode(mode) && worn) {
    return (
      <HandAnchor productId={productId} site="wrist">
        <primitive object={parts.model} />
        <primitive object={parts.occluder} />
      </HandAnchor>
    );
  }

  // Declarative layout, so React moves the model back onto its cushion after try-on. The tilted group (watch on
  // its cushion) is what cart thumbnails render.
  return (
    <PedestalMount productId={productId} hitBox={parts.hitBox}>
      <group position-y={parts.lift} scale={DISPLAY_SCALE}>
        <group rotation={DISPLAY_ROTATION} ref={(g) => setProductModel(productId, g)}>
          <primitive object={parts.model} />
          <primitive object={parts.cushion} />
        </group>
      </group>
    </PedestalMount>
  );
}
