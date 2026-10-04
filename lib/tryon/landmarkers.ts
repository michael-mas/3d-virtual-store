import type { FaceLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";
import { isDebugEnabled } from "../debug";
import { silenceMediaPipeModule } from "../quietConsole";
import { loadModel, loadWasmFileset, releaseModel, type TrackerKind, type WasmFileset } from "./assets";

type Delegate = "GPU" | "CPU";

/** Creates a landmarker on the GPU delegate, or on the CPU when the GPU one can't be created. */
async function withFallback<T>(kind: TrackerKind, create: (fileset: WasmFileset, model: Uint8Array, delegate: Delegate) => Promise<T>) {
  const [fileset, model] = await Promise.all([loadWasmFileset(), loadModel(kind)]);
  let landmarker: T;
  try {
    silenceMediaPipeModule();
    landmarker = await create(fileset, model, "GPU");
  } catch (error) {
    if (isDebugEnabled()) console.warn(`[tryOn] ${kind}: GPU delegate unavailable, falling back to CPU`, error);
    silenceMediaPipeModule();
    landmarker = await create(fileset, model, "CPU");
  }
  releaseModel(kind);
  return landmarker;
}

/** One instance per kind, reused across try-on sessions; a failure clears it so a retry creates it again. */
function lazy<T>(create: () => Promise<T>): () => Promise<T> {
  let instance: Promise<T> | null = null;
  return () => {
    instance ??= create();
    instance.catch(() => (instance = null));
    return instance;
  };
}

/**
 * FaceLandmarker. Nothing MediaPipe-related (JS, WASM, model) is loaded before this is called (or before the idle
 * prefetch in CUSTOMIZE); the JS is a dynamic import.
 */
export const getFaceLandmarker = lazy(async (): Promise<FaceLandmarker> => {
  const { FaceLandmarker } = await import("@mediapipe/tasks-vision");
  return withFallback("face", (fileset, model, delegate) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: model, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      // Blendshape scores (e.g. jawOpen) drive expression-reactive surface effects (face paint glow).
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    }),
  );
});

/** HandLandmarker (one hand: watches and rings are tried on one hand at a time). */
export const getHandLandmarker = lazy(async (): Promise<HandLandmarker> => {
  const { HandLandmarker } = await import("@mediapipe/tasks-vision");
  return withFallback("hand", (fileset, model, delegate) =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: model, delegate },
      runningMode: "VIDEO",
      numHands: 1,
    }),
  );
});

export const getLandmarker = { face: getFaceLandmarker, hand: getHandLandmarker } as const;
