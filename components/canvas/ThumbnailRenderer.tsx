"use client";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  RenderTarget,
  Scene,
  Sphere,
  Vector3,
  type WebGPURenderer,
} from "three/webgpu";
import { setThumbnailRenderer } from "@/lib/cart/registry";
import { DRACO_DECODER_PATH } from "@/lib/assets";
import { getProduct } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

const SIZE = 256;
const VIEW_DIR = new Vector3(0.55, 0.25, 1).normalize();

/**
 * Renders the product into a dedicated 256px render target with its own scene and camera, reads the
 * pixels back asynchronously and encodes a PNG. The model is cloned, so it carries the materials of
 * the current configuration (materials are shared, not copied).
 */
export default function ThumbnailRenderer() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const mainScene = useThree((s) => s.scene);
  const productId = useAppStore((s) => s.activeProductId);
  const { scene: model } = useGLTF(getProduct(productId)!.model, DRACO_DECODER_PATH);

  const { target, camera, scene } = useMemo(() => {
    const target = new RenderTarget(SIZE, SIZE, { samples: 4 });
    const camera = new PerspectiveCamera(30, 1, 0.005, 10);
    const scene = new Scene();
    scene.background = new Color("#3a3633");
    const key = new DirectionalLight("#ffffff", 1.6);
    key.position.set(0.6, 1.2, 0.8);
    scene.add(key);
    return { target, camera, scene };
  }, []);

  useEffect(() => () => target.dispose(), [target]);

  useEffect(() => {
    // Everything before the first `await` (clone + render) runs synchronously in the caller's task,
    // so the thumbnail reflects the configuration at call time even though readback is async.
    const render = async (): Promise<Blob> => {
      const snapshot = model.clone();
      snapshot.position.set(0, 0, 0);
      snapshot.updateMatrixWorld(true);

      // Frame the model's bounding sphere from a fixed 3/4 view.
      const sphere = new Box3().setFromObject(snapshot).getBoundingSphere(new Sphere());
      const distance = (sphere.radius / Math.sin(((camera.fov / 2) * Math.PI) / 180)) * 1.02;
      camera.position.copy(sphere.center).addScaledVector(VIEW_DIR, distance);
      camera.lookAt(sphere.center);

      scene.environment = mainScene.environment;
      scene.add(snapshot);

      // As an output target, the RT gets tone mapping + sRGB encoding like the screen.
      const prevTarget = gl.getRenderTarget();
      const prevOutput = gl.getOutputRenderTarget();
      const prevToneMapping = gl.toneMapping;
      try {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.setOutputRenderTarget(target);
        gl.setRenderTarget(target);
        gl.render(scene, camera);
      } finally {
        gl.setRenderTarget(prevTarget);
        gl.setOutputRenderTarget(prevOutput);
        gl.toneMapping = prevToneMapping;
        scene.remove(snapshot);
      }

      const pixels = await gl.readRenderTargetPixelsAsync(target, 0, 0, SIZE, SIZE);
      const rgba = new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, SIZE * SIZE * 4);
      const image = new ImageData(SIZE, SIZE);
      // WebGL readPixels rows are bottom-up; WebGPU texture copies are top-down.
      const bottomUp = (gl.backend as { isWebGLBackend?: boolean }).isWebGLBackend === true;
      const row = SIZE * 4;
      for (let y = 0; y < SIZE; y++) {
        const src = (bottomUp ? SIZE - 1 - y : y) * row;
        image.data.set(rgba.subarray(src, src + row), y * row);
      }

      const canvas = new OffscreenCanvas(SIZE, SIZE);
      canvas.getContext("2d")!.putImageData(image, 0, 0);
      return canvas.convertToBlob({ type: "image/png" });
    };

    setThumbnailRenderer(render);
    return () => setThumbnailRenderer(null);
  }, [gl, mainScene, model, target, camera, scene]);

  return null;
}
