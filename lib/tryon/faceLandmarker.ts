import { FaceLandmarker, FilesetResolver, type FaceLandmarkerOptions } from "@mediapipe/tasks-vision";
import { FACE_LANDMARKER_MODEL_PATH, MEDIAPIPE_WASM_PATH } from "@/lib/assets";

let instance: Promise<FaceLandmarker> | null = null;

const options = (delegate: "GPU" | "CPU"): FaceLandmarkerOptions => ({
  baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_PATH, delegate },
  runningMode: "VIDEO",
  numFaces: 1,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: true,
});

/** Lazily creates one FaceLandmarker (WASM + model from /public), reused across try-on sessions. */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  instance ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
    try {
      return await FaceLandmarker.createFromOptions(fileset, options("GPU"));
    } catch (error) {
      console.warn("[tryOn] GPU delegate unavailable, falling back to CPU", error);
      return FaceLandmarker.createFromOptions(fileset, options("CPU"));
    }
  })();
  instance.catch(() => (instance = null));
  return instance;
}
