"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { max, oneMinus, pass, screenUV, smoothstep, uniform, vec4 } from "three/tsl";
import { ACESFilmicToneMapping, NoToneMapping, RenderPipeline, Vector3, type WebGPURenderer } from "three/webgpu";
import { productPosition } from "@/lib/explore/layout";
import { isTryOnMode } from "@/lib/modes";
import { setCaptureRenderer } from "@/lib/tryon/capture";
import { useAppStore } from "@/store/useAppStore";

/**
 * TSL post-processing: in CUSTOMIZE, dims everything behind the product (depth mask) plus a soft vignette.
 * One scene pass + one full-screen composite; no blur / DoF passes.
 * Takes over rendering (useFrame priority 1) — R3F's default render is skipped.
 */
export default function PostFx() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const get = useThree((s) => s.get);
  const enabled = useAppStore((s) => s.postFx);
  const tryOn = useAppStore((s) => isTryOnMode(s.mode));

  const { pipeline, scenePass, dim, focus } = useMemo(() => {
    const dim = uniform(0);
    const focus = uniform(0.3);
    // The default camera changes in try-on; the pass follows it in useFrame instead of being rebuilt.
    const scenePass = pass(scene, get().camera, { samples: 4 });
    const color = scenePass.getTextureNode("output");
    const distance = scenePass.getViewZNode().negate();
    // 0 on the product, 1 on anything farther than focus + 8cm (incl. empty background).
    const behind = smoothstep(focus.add(0.02), focus.add(0.08), distance);
    const vignette = smoothstep(0.35, 0.8, screenUV.sub(0.5).length().mul(1.3));
    const amount = dim.mul(max(behind.mul(0.72), vignette.mul(0.55)));
    const pipeline = new RenderPipeline(gl, vec4(color.rgb.mul(oneMinus(amount)), color.a));
    return { pipeline, scenePass, dim, focus };
  }, [gl, scene, get]);

  useEffect(() => () => pipeline.dispose(), [pipeline]);

  // The webcam background must not be tone mapped; the output transform is rebuilt once per switch.
  useEffect(() => {
    gl.toneMapping = tryOn ? NoToneMapping : ACESFilmicToneMapping;
    pipeline.needsUpdate = true;
  }, [gl, pipeline, tryOn]);

  const renderFrame = useMemo(
    () => () => {
      const camera = get().camera;
      scenePass.camera = camera;
      if (enabled) pipeline.render();
      else gl.render(scene, camera);
    },
    [get, gl, scene, scenePass, pipeline, enabled],
  );

  // Photo capture renders synchronously through the same path, then reads the canvas in the same task.
  useEffect(() => {
    setCaptureRenderer(renderFrame);
    return () => setCaptureRenderer(null);
  }, [renderFrame]);

  const productPos = useMemo(() => new Vector3(), []);

  useFrame((state, delta) => {
    const { mode, activeProductId } = useAppStore.getState();
    const target = mode === "CUSTOMIZE" ? 1 : 0;
    // Frame-rate independent ease toward target.
    dim.value += (target - dim.value) * (1 - Math.exp(-delta * 6));
    // Focus distance = camera distance to the active product.
    focus.value = state.camera.position.distanceTo(productPos.set(...productPosition(activeProductId)));
    renderFrame();
  }, 1);

  return null;
}
