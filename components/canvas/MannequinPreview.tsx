"use client";

import { useEffect, useMemo } from "react";
import { Color, Group, Mesh, MeshPhysicalNodeMaterial } from "three/webgpu";
import { setProductModel } from "@/lib/cart/registry";
import { MANNEQUIN_FACE_Y, MANNEQUIN_SCALE } from "@/lib/preview";
import { getProduct, type ProductRenderer } from "@/lib/products";
import { createFacePaintPreview } from "@/lib/tryon/surface/facePaint";
import { createLipstickPreview } from "@/lib/tryon/surface/lipstick";
import { createMannequinGeometry } from "@/lib/tryon/surface/mannequin";
import type { SurfacePreview } from "@/lib/tryon/surface/types";
import { useAppStore } from "@/store/useAppStore";

/** Neutral plaster-like mannequin skin. */
const SKIN = new Color("#d9d0c7");

const PREVIEWS: Partial<Record<ProductRenderer, (skin: Color) => SurfacePreview>> = {
  lipstick: createLipstickPreview,
  facePaint: createFacePaintPreview,
};

/**
 * A surface product applied to a neutral mannequin head built from the canonical face (no webcam needed).
 * Shown on the pedestal in CUSTOMIZE, and registered as the product's model while visible, so cart thumbnails
 * render the mannequin with the current configuration. Loaded lazily (its own chunk with the face topology).
 */
export default function MannequinPreview({ productId, visible }: { productId: string; visible: boolean }) {
  const config = useAppStore((s) => s.configs[productId]);
  const renderer = getProduct(productId)!.renderer;

  const parts = useMemo(() => {
    const create = PREVIEWS[renderer];
    if (!create) throw new Error(`No mannequin preview for renderer "${renderer}"`);
    const preview = create(SKIN);
    const skin = new MeshPhysicalNodeMaterial({ name: "mannequin-skin", color: SKIN, roughness: 0.65 });
    const geometry = createMannequinGeometry();
    const group = new Group();
    group.name = "mannequin";
    group.add(new Mesh(geometry.face, preview.material), new Mesh(geometry.head, skin), new Mesh(geometry.neck, skin));
    group.scale.setScalar(MANNEQUIN_SCALE);
    group.position.y = MANNEQUIN_FACE_Y;
    return { group, preview, skin, geometries: Object.values(geometry) };
  }, [renderer]);

  useEffect(
    () => () => {
      parts.preview.dispose();
      parts.skin.dispose();
      parts.geometries.forEach((g) => g.dispose());
    },
    [parts],
  );

  useEffect(() => parts.preview.apply(config), [parts, config]);

  // The cart thumbnail renders whatever model is registered for the active product.
  useEffect(() => {
    if (!visible) return;
    setProductModel(productId, parts.group);
    return () => setProductModel(productId, null);
  }, [productId, parts, visible]);

  return <primitive object={parts.group} visible={visible} />;
}
