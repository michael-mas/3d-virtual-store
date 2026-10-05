"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalNodeMaterial,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three/webgpu";
import { wornProductIds } from "@/lib/cart/look";
import { setProductModel } from "@/lib/cart/registry";
import { isTryOnMode } from "@/lib/modes";
import { getProduct } from "@/lib/products";
import { HAIR_FINISH_LOOK, readHairDyeConfig } from "@/lib/products/hairDye";
import { tracking } from "@/lib/tryon/tracking";
import { hairLayer } from "@/lib/tryon/videoLayer";
import { useAppStore } from "@/store/useAppStore";
import { restOnPedestal } from "./displayHelpers";
import PedestalMount from "./PedestalMount";

const DISPLAY_SCALE = 1.4;

/** Squeeze bottle profile (radius, height in meters): rounded base, shoulder, neck. */
function bottleGeometry(): BufferGeometry {
  const profile = [
    [0, 0],
    [0.017, 0],
    [0.02, 0.004],
    [0.02, 0.058],
    [0.016, 0.066],
    [0.007, 0.07],
    [0.007, 0.074],
    [0, 0.074],
  ].map(([r, h]) => new Vector2(r, h));
  return new LatheGeometry(profile, 40);
}

/** A lock of hair lying on the pedestal: thin strands along slightly fanned, gently curling paths. */
function lockGeometries(): BufferGeometry[] {
  const strands: BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const t = i / 10 - 0.5;
    const curve = new CatmullRomCurve3([
      new Vector3(t * 0.004, 0.0015, 0),
      new Vector3(t * 0.006 + 0.012, 0.0022, 0.006),
      new Vector3(t * 0.009 + 0.026, 0.0018, 0.004),
      new Vector3(t * 0.012 + 0.036, 0.0012 + Math.abs(t) * 0.002, -0.004),
    ]);
    strands.push(new TubeGeometry(curve, 24, 0.0009, 5, false));
  }
  return strands;
}

/**
 * Hair color on its pedestal: a dye bottle whose label and swatch show the configured color. In try-on nothing is
 * drawn in 3D: the hair the segmenter finds in the video is recolored by the scene background (hairLayer in
 * lib/tryon/videoLayer.ts), which this component drives from the worn configuration.
 */
export default function HairDye({ productId }: { productId: string }) {
  const config = readHairDyeConfig(useAppStore((s) => s.configs[productId]));

  const parts = useMemo(() => {
    const bottleMat = new MeshPhysicalNodeMaterial({ name: "dye-bottle", color: "#f4f1ec", roughness: 0.35, clearcoat: 0.6 });
    const labelMat = new MeshPhysicalNodeMaterial({ name: "dye-label", roughness: 0.5 });
    const capMat = new MeshPhysicalNodeMaterial({ name: "dye-cap", color: "#1c1917", roughness: 0.4 });
    const swatchMat = new MeshPhysicalNodeMaterial({ name: "dye-swatch", roughness: 0.6, sheen: 1 });
    const geometries: BufferGeometry[] = [bottleGeometry(), new CylinderGeometry(0.0205, 0.0205, 0.03, 40, 1, true), new ConeGeometry(0.0055, 0.016, 20)];
    const [bottleGeo, labelGeo, nozzleGeo] = geometries;
    const strandGeos = lockGeometries();
    geometries.push(...strandGeos);

    const model = new Group();
    model.name = "hair-dye";
    const bottle = new Mesh(bottleGeo, bottleMat);
    const label = new Mesh(labelGeo, labelMat);
    label.position.y = 0.032;
    const nozzle = new Mesh(nozzleGeo, capMat);
    nozzle.position.y = 0.082;
    // A lock of dyed hair lying beside the bottle.
    const swatch = new Group();
    for (const g of strandGeos) swatch.add(new Mesh(g, swatchMat));
    swatch.rotation.y = -0.5;
    swatch.position.set(0.016, 0, 0.012);
    model.add(bottle, label, nozzle, swatch);
    model.scale.setScalar(DISPLAY_SCALE);
    model.position.y = -0.024;
    const { lift, hitBox } = restOnPedestal(model);
    model.position.y += lift;
    return { model, hitBox, materials: { bottleMat, labelMat, capMat, swatchMat }, geometries };
  }, []);

  useEffect(() => {
    setProductModel(productId, parts.model);
    return () => {
      setProductModel(productId, null);
      parts.geometries.forEach((g) => g.dispose());
      Object.values(parts.materials).forEach((m) => m.dispose());
    };
  }, [productId, parts]);

  useEffect(() => {
    parts.materials.labelMat.color.set(config.color);
    parts.materials.swatchMat.color.set(config.color);
  }, [parts, config.color]);

  // Try-on: drive the background's hair dye while this product is worn and hair is in view.
  useFrame(() => {
    const state = useAppStore.getState();
    const on = isTryOnMode(state.mode) && tracking.hair.present && wornProductIds(state).includes(productId);
    if (!on) {
      // One hair color per look: when another one is worn, it drives the layer.
      const otherWorn = wornProductIds(state).some((id) => id !== productId && getProduct(id)?.zone === "hair");
      if (!otherWorn) hairLayer.enabled.value = 0;
      return;
    }
    const c = readHairDyeConfig(state.configs[productId]);
    const look = HAIR_FINISH_LOOK[c.finish];
    hairLayer.color.value.set(c.color);
    hairLayer.intensity.value = c.intensity;
    hairLayer.lift.value = look.lift;
    hairLayer.pastel.value = look.pastel;
    hairLayer.enabled.value = 1;
  });

  return (
    <PedestalMount productId={productId} hitBox={parts.hitBox}>
      <primitive object={parts.model} />
    </PedestalMount>
  );
}
