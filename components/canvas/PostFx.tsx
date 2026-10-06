"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { max, oneMinus, pass, screenUV, smoothstep, uniform, vec4 } from "three/tsl";
import { ACESFilmicToneMapping, NoToneMapping, RenderPipeline, Vector3, type Camera, type Scene, type WebGPURenderer } from "three/webgpu";
import { productPosition } from "@/lib/explore/layout";
import { previewFraming } from "@/lib/preview";
import { isTryOnMode } from "@/lib/modes";
import { setCaptureRenderer } from "@/lib/tryon/capture";
import { useAppStore } from "@/store/useAppStore";

const BLOOM_STRENGTH = 0.3;
/** Consecutive failed frames before the effects are switched off, then before the error is shown. */
const FAILURES_BEFORE_FALLBACK = 3;
const FAILURES_BEFORE_ERROR = 30;
/** GPU validation errors tolerated (each rebuilds the chain) before the effects are switched off. */
const GPU_ERRORS_BEFORE_FALLBACK = 3;

const makeUniforms = () => ({ dim: uniform(0), focus: uniform(0.3) });
type Uniforms = ReturnType<typeof makeUniforms>;
/** The WebGPU device's error channel (typed locally: the app doesn't ship the @webgpu/types globals). */
type ErrorTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;
type Chain = { pipeline: RenderPipeline; scenePass: ReturnType<typeof pass>; glow: ReturnType<typeof bloom> };

/** The post-processing chain: scene pass (MSAA), bloom, CUSTOMIZE background dim and vignette. */
function buildChain(gl: WebGPURenderer, scene: Scene, camera: Camera, u: Uniforms, tryOn: boolean): Chain {
  const scenePass = pass(scene, camera, { samples: 4 });
  const color = scenePass.getTextureNode("output");
  const distance = scenePass.getViewZNode().negate();
  // 0 on the product, 1 on anything farther than focus + 8cm (incl. empty background).
  const behind = smoothstep(u.focus.add(0.02), u.focus.add(0.08), distance);
  const vignette = smoothstep(0.35, 0.8, screenUV.sub(0.5).length().mul(1.3));
  const amount = u.dim.mul(max(behind.mul(0.72), vignette.mul(0.55)));
  const glow = bloom(color, tryOn ? 0 : BLOOM_STRENGTH, 0.5, 1);
  const lit = color.rgb.add(glow.rgb);
  const pipeline = new RenderPipeline(gl, vec4(lit.mul(oneMinus(amount)), color.a));
  return { pipeline, scenePass, glow };
}

/**
 * TSL post-processing: a soft bloom on the salon's lights and brass (off in try-on, where the background is the
 * camera), and in CUSTOMIZE, dims everything behind the product (depth mask) plus a soft vignette.
 * Takes over rendering (useFrame priority 1) — R3F's default render is skipped.
 *
 * The chain's render targets live exactly as long as the effect that builds them: built in the effect, disposed in
 * its cleanup, never reused after disposal (a disposed chain still referenced by its bindings makes WebGPU reject
 * every frame with "Destroyed texture used in a submit", and the view freezes). GPU validation errors are watched:
 * the chain is rebuilt on one, and after a few the effects are switched off so the salon keeps rendering.
 */
export default function PostFx() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const get = useThree((s) => s.get);
  const enabled = useAppStore((s) => s.postFx);
  const tryOn = useAppStore((s) => isTryOnMode(s.mode));

  const uniforms = useMemo(() => makeUniforms(), []);
  const chain = useRef<Chain | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = buildChain(gl, scene, get().camera, uniforms, isTryOnMode(useAppStore.getState().mode));
    chain.current = current;
    let gpuErrors = 0;
    let lastRebuild = 0;

    // WebGPU reports invalid submissions asynchronously, not as exceptions.
    const device = (gl as unknown as { backend?: { device?: ErrorTarget } }).backend?.device;
    const onGpuError = (event: Event) => {
      const message = (event as Event & { error?: { message?: string } }).error?.message ?? "";
      gpuErrors++;
      if (gpuErrors === 1) console.error("[render] GPU validation error, rebuilding the effects", message);
      if (gpuErrors >= GPU_ERRORS_BEFORE_FALLBACK) {
        console.warn("[render] switching effects off after repeated GPU errors");
        useAppStore.getState().setPostFx(false);
        return;
      }
      // Rebuild at most once per frame burst.
      const now = performance.now();
      if (now - lastRebuild < 250) return;
      lastRebuild = now;
      current.pipeline.dispose();
      current = buildChain(gl, scene, get().camera, uniforms, isTryOnMode(useAppStore.getState().mode));
      chain.current = current;
    };
    device?.addEventListener("uncapturederror", onGpuError);

    return () => {
      device?.removeEventListener("uncapturederror", onGpuError);
      chain.current = null;
      current.pipeline.dispose();
    };
  }, [gl, scene, get, uniforms, enabled]);

  // The webcam background must not be tone mapped; the output transform is rebuilt once per switch.
  useEffect(() => {
    gl.toneMapping = tryOn ? NoToneMapping : ACESFilmicToneMapping;
    const c = chain.current;
    if (!c) return;
    c.glow.strength.value = tryOn ? 0 : BLOOM_STRENGTH;
    c.pipeline.needsUpdate = true;
  }, [gl, tryOn, enabled]);

  const renderFrame = useMemo(
    () => () => {
      const camera = get().camera;
      const c = chain.current;
      if (c) {
        c.scenePass.camera = camera;
        c.pipeline.render();
      } else gl.render(scene, camera);
    },
    [get, gl, scene],
  );

  // Photo capture renders synchronously through the same path, then reads the canvas in the same task.
  useEffect(() => {
    setCaptureRenderer(renderFrame);
    return () => setCaptureRenderer(null);
  }, [renderFrame]);

  const productPos = useMemo(() => new Vector3(), []);

  /**
   * A frame that throws would otherwise leave the last image on screen while the app keeps running (the view
   * "freezes"). The error is logged once; after a few failed frames the effects (post-processing, floor
   * reflection) are switched off and rendering retries plainly; if that fails too, the error is shown.
   */
  const failures = useRef(0);
  const onRenderFailure = (error: unknown) => {
    failures.current++;
    if (failures.current === 1) console.error("[render] frame failed", error);
    const { postFx, setPostFx, setRendererError } = useAppStore.getState();
    if (failures.current === FAILURES_BEFORE_FALLBACK && postFx) {
      console.warn("[render] switching effects off after repeated failures");
      setPostFx(false);
      failures.current = 0;
    } else if (failures.current >= FAILURES_BEFORE_ERROR) {
      setRendererError(`The 3D view stopped rendering (${error instanceof Error ? error.message : String(error)}). Reload to continue.`);
    }
  };

  useFrame((state, delta) => {
    const { mode, activeProductId } = useAppStore.getState();
    const target = mode === "CUSTOMIZE" ? 1 : 0;
    // Frame-rate independent ease toward target.
    uniforms.dim.value += (target - uniforms.dim.value) * (1 - Math.exp(-delta * 6));
    // Focus distance = camera distance to the active product.
    productPos.set(...productPosition(activeProductId));
    productPos.y += previewFraming(activeProductId).liftY;
    uniforms.focus.value = state.camera.position.distanceTo(productPos);
    try {
      renderFrame();
      failures.current = 0;
    } catch (error) {
      onRenderFailure(error);
    }
  }, 1);

  return null;
}
