import type { FaceLandmarker, FaceLandmarkerOptions } from "@mediapipe/tasks-vision";
import { isDebugEnabled } from "../debug";
import { silenceMediaPipeModule } from "../quietConsole";
import { loadTryOnAssets, releaseTryOnAssets } from "./assets";

let instance: Promise<FaceLandmarker> | null = null;

const options = (delegate: "GPU" | "CPU", model: Uint8Array): FaceLandmarkerOptions => ({
  baseOptions: { modelAssetBuffer: model, delegate },
  runningMode: "VIDEO",
  numFaces: 1,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: true,
});

/**
 * Lazily creates one FaceLandmarker, reused across try-on sessions. Nothing MediaPipe-related (JS, WASM, model)
 * is loaded before this is called (or before the idle prefetch in CUSTOMIZE); the JS is a dynamic import.
 */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  instance ??= (async () => {
    const [{ FaceLandmarker }, assets] = await Promise.all([import("@mediapipe/tasks-vision"), loadTryOnAssets()]);
    let landmarker: FaceLandmarker;
    try {
      silenceMediaPipeModule();
      landmarker = await FaceLandmarker.createFromOptions(assets.fileset, options("GPU", assets.model));
    } catch (error) {
      if (isDebugEnabled()) console.warn("[tryOn] GPU delegate unavailable, falling back to CPU", error);
      silenceMediaPipeModule();
      landmarker = await FaceLandmarker.createFromOptions(assets.fileset, options("CPU", assets.model));
    }
    releaseTryOnAssets();
    return landmarker;
  })();
  instance.catch(() => (instance = null));
  return instance;
}
