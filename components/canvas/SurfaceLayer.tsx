"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { checker, luminance, uv, vec3 } from "three/tsl";
import {
  Color,
  FrontSide,
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  Scene,
  Vector2,
  type WebGPURenderer,
} from "three/webgpu";
import { isTryOnMode } from "@/lib/modes";
import { createFaceMeshGeometry, updateFaceMeshPositions } from "@/lib/tryon/faceMesh";
import { tracking } from "@/lib/tryon/tracking";
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

/**
 * Surface attachment layer: the face mesh built from the 468 tessellated landmarks, drawn by an orthographic
 * camera covering the video frame ([0, 1]², see lib/tryon/faceMesh.ts) into `surfaceLayer.target`, which the
 * scene background composites under the rigid layer (lib/tryon/videoLayer.ts). Runs before PostFx renders.
 * Positions are rewritten in place only when a new detection arrived.
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
    return { scene, camera, geometry, mesh, debug: createDebugMaterials(), version: -1 };
  }, []);

  useEffect(
    () => () => {
      layer.geometry.dispose();
      Object.values(layer.debug).forEach((m) => m.dispose());
      surfaceLayer.enabled.value = 0;
    },
    [layer],
  );

  const size = useMemo(() => new Vector2(), []);
  const clearColor = useMemo(() => new Color(), []);

  useFrame(() => {
    const { mode, tryOnStatus, surfaceDebug } = useAppStore.getState();
    const material = surfaceDebug === "off" ? null : layer.debug[surfaceDebug];
    const active = isTryOnMode(mode) && tryOnStatus === "running" && tracking.hasFace && material !== null;
    surfaceLayer.enabled.value = active ? 1 : 0;
    if (!active) return;

    layer.mesh.material = material;
    if (layer.version !== tracking.landmarksVersion) {
      layer.version = tracking.landmarksVersion;
      updateFaceMeshPositions(layer.geometry, tracking.landmarks);
    }

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
