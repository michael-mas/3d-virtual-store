"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { checker, luminance, uv, vec3 } from "three/tsl";
import {
  BufferGeometry,
  Color,
  FrontSide,
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  Scene,
  Vector2,
  type Material,
  type WebGPURenderer,
} from "three/webgpu";
import { isTryOnMode } from "@/lib/modes";
import { getProduct, type ProductRenderer } from "@/lib/products";
import { createFaceMeshGeometry, updateFaceMeshPositions } from "@/lib/tryon/faceMesh";
import { tracking } from "@/lib/tryon/tracking";
import { createFacePaintSurface } from "@/lib/tryon/surface/facePaint";
import { createLipstickSurface } from "@/lib/tryon/surface/lipstick";
import type { SurfaceProduct } from "@/lib/tryon/surface/types";
import { surfaceLayer, videoColor } from "@/lib/tryon/videoLayer";
import { useAppStore, type SurfaceDebug } from "@/store/useAppStore";

/** Debug materials for the surface pipeline (dev calibration panel). */
function createDebugMaterials(): Record<Exclude<SurfaceDebug, "off">, MeshBasicNodeMaterial> {
  const common = { side: FrontSide, transparent: true, depthWrite: true };

  // UV checker: 12×12 cells, tinted by (u, v) so orientation is visible (red → right, green → up).
  const uvChecker = new MeshBasicNodeMaterial({ name: "surface-debug-uv", ...common });
  const cell = checker(uv().mul(12));
  uvChecker.colorNode = vec3(uv().x, uv().y, 0.35).mul(cell.mul(0.65).add(0.35));
  uvChecker.opacityNode = cell.mul(0.25).add(0.6);

  // Video luminance, magenta-tinted: checks that `videoColor` addresses the same pixel as the frame beneath.
  const luma = new MeshBasicNodeMaterial({ name: "surface-debug-luma", ...common });
  luma.colorNode = vec3(1, 0.35, 1).mul(luminance(videoColor.rgb));

  return { uv: uvChecker, luma };
}

/** Surface try-on implementation per product renderer (only renderers of `surface` products appear here). */
const SURFACES: Partial<Record<ProductRenderer, () => SurfaceProduct>> = {
  lipstick: createLipstickSurface,
  facePaint: createFacePaintSurface,
};

/**
 * Surface attachment layer: the face mesh built from the 468 tessellated landmarks, drawn by an orthographic
 * camera covering the video frame ([0, aspect] × [0, 1], see lib/tryon/faceMesh.ts) into `surfaceLayer.target`,
 * which the scene background composites under the rigid layer (lib/tryon/videoLayer.ts). Runs before PostFx.
 * Draws the active `surface` product (or a debug view). Positions and normals are rewritten in place only when a
 * new detection arrived; each product's geometry shares those attributes with its own triangle subset.
 */
export default function SurfaceLayer() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;

  const layer = useMemo(() => {
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 1, 1, 0, -10, 10);
    const geometry = createFaceMeshGeometry();
    const mesh = new Mesh(geometry);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const products = new Map<ProductRenderer, { surface: SurfaceProduct; geometry: BufferGeometry }>();
    return { scene, camera, geometry, mesh, products, debug: createDebugMaterials(), version: -1, aspect: 0 };
  }, []);

  useEffect(
    () => () => {
      layer.geometry.dispose();
      Object.values(layer.debug).forEach((m) => m.dispose());
      for (const p of layer.products.values()) {
        p.surface.dispose();
        p.geometry.dispose();
      }
      surfaceLayer.enabled.value = 0;
    },
    [layer],
  );

  /** The active surface product's material + geometry, created on first use. */
  const productLayer = (renderer: ProductRenderer) => {
    let entry = layer.products.get(renderer);
    const create = SURFACES[renderer];
    if (!entry && create) {
      const surface = create();
      const geometry = new BufferGeometry();
      for (const name of ["position", "normal", "uv"]) geometry.setAttribute(name, layer.geometry.getAttribute(name));
      geometry.setIndex(surface.triangles ?? layer.geometry.getIndex());
      entry = { surface, geometry };
      layer.products.set(renderer, entry);
    }
    return entry;
  };

  const size = useMemo(() => new Vector2(), []);
  const clearColor = useMemo(() => new Color(), []);

  useFrame(() => {
    const { mode, tryOnStatus, surfaceDebug, activeProductId, configs } = useAppStore.getState();
    const running = isTryOnMode(mode) && tryOnStatus === "running" && tracking.hasFace && tracking.video !== null;
    let draw: { material: Material; geometry: BufferGeometry; surface?: SurfaceProduct } | null = null;
    if (running && surfaceDebug !== "off") {
      draw = { material: layer.debug[surfaceDebug], geometry: layer.geometry };
    } else if (running) {
      const product = getProduct(activeProductId);
      const entry = product?.attachment === "surface" ? productLayer(product.renderer) : undefined;
      if (entry) {
        entry.surface.apply(configs[activeProductId]);
        draw = { material: entry.surface.material, geometry: entry.geometry, surface: entry.surface };
      }
    }
    surfaceLayer.enabled.value = draw ? 1 : 0;
    if (!draw) return;

    layer.mesh.material = draw.material;
    layer.mesh.geometry = draw.geometry;

    // Video layer units: the frame height is 1, its width the video aspect (isotropic, for real normals).
    const video = tracking.video!;
    const aspect = video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 1;
    if (aspect !== layer.aspect) {
      layer.aspect = aspect;
      layer.camera.right = aspect;
      layer.camera.updateProjectionMatrix();
      layer.version = -1;
    }
    if (layer.version !== tracking.landmarksVersion) {
      layer.version = tracking.landmarksVersion;
      updateFaceMeshPositions(layer.geometry, tracking.landmarks, aspect);
    }
    draw.surface?.update?.(tracking.landmarks, aspect);

    const target = surfaceLayer.target;
    gl.getDrawingBufferSize(size);
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);

    const previousTarget = gl.getRenderTarget();
    gl.getClearColor(clearColor);
    const clearAlpha = gl.getClearAlpha();
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.render(layer.scene, layer.camera);
    gl.setRenderTarget(previousTarget);
    gl.setClearColor(clearColor, clearAlpha);
  }, 0.5);

  return null;
}
