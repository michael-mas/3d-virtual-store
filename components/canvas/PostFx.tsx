"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { oneMinus, pass, screenUV, smoothstep, uniform, vec4, max } from "three/tsl";
import { RenderPipeline, type WebGPURenderer } from "three/webgpu";
import { useAppStore } from "@/store/useAppStore";

/**
 * TSL post-processing: in CUSTOMIZE, dims everything behind the product (depth mask) plus a soft vignette.
 * One scene pass + one full-screen composite; no blur / DoF passes.
 * Takes over rendering (useFrame priority 1) — R3F's default render is skipped.
 */
export default function PostFx() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const enabled = useAppStore((s) => s.postFx);

  const { pipeline, dim, focus } = useMemo(() => {
    const dim = uniform(0);
    const focus = uniform(0.3);
    const scenePass = pass(scene, camera, { samples: 4 });
    const color = scenePass.getTextureNode("output");
    const distance = scenePass.getViewZNode().negate();
    // 0 on the product, 1 on anything farther than focus + 8cm (incl. empty background).
    const behind = smoothstep(focus.add(0.02), focus.add(0.08), distance);
    const vignette = smoothstep(0.35, 0.8, screenUV.sub(0.5).length().mul(1.3));
    const amount = dim.mul(max(behind.mul(0.72), vignette.mul(0.55)));
    const pipeline = new RenderPipeline(gl, vec4(color.rgb.mul(oneMinus(amount)), color.a));
    return { pipeline, dim, focus };
  }, [gl, scene, camera]);

  useEffect(() => () => pipeline.dispose(), [pipeline]);

  useFrame((state, delta) => {
    const target = useAppStore.getState().mode === "CUSTOMIZE" ? 1 : 0;
    // Frame-rate independent ease toward target.
    dim.value += (target - dim.value) * (1 - Math.exp(-delta * 6));
    // Focus distance = camera distance to the product (at the origin).
    focus.value = state.camera.position.length();
    if (enabled) pipeline.render();
    else gl.render(scene, camera);
  }, 1);

  return null;
}
