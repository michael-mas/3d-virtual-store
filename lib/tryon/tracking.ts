import { Matrix4 } from "three";
import { LANDMARK_COUNT } from "./constants";
import { HAND_LANDMARK_COUNT, type Handedness } from "./handPose";

/**
 * Per-frame try-on state shared between the DOM session (webcam + Face/HandLandmarker) and the R3F scene.
 * Kept outside React/zustand: it changes at video frame rate.
 */
export const tracking = {
  /** Playing webcam element while a session is running. */
  video: null as HTMLVideoElement | null,
  /** Smoothed facial transformation matrix (canonical face cm → camera cm). */
  pose: new Matrix4(),
  hasFace: false,
  /**
   * Raw normalized landmarks of the last detection with a face (flat x, y, z; x/y in [0, 1] of the video frame,
   * z depth, smaller = closer). Written in place. Not smoothed again here: in VIDEO mode with numFaces 1,
   * FaceLandmarker's own graph already runs a One Euro LandmarksSmoothingCalculator on them (MediaPipe
   * face_landmarker_graph.cc / face_landmarks_detector_graph.cc); extra filtering would only add lag.
   */
  landmarks: new Float32Array(LANDMARK_COUNT * 3),
  /** Incremented every time `landmarks` is rewritten (lets the scene skip redundant geometry uploads). */
  landmarksVersion: 0,
  /** FaceLandmarker "jawOpen" blendshape score of the last detection (0 closed … 1 wide open). */
  jawOpen: 0,
  /** The tracked hand (HandLandmarker, one hand), when a hand product is worn. */
  hand: {
    present: false,
    /** Smoothed camera-space landmarks (21 × xyz, meters), see lib/tryon/handPose.ts. */
    points: new Float32Array(HAND_LANDMARK_COUNT * 3),
    /** MediaPipe's label, with hysteresis (a one-frame flip would turn the watch over). */
    handedness: "Right" as Handedness,
  },
  /**
   * Hair segmented in the frame (mask in lib/tryon/videoLayer.ts), when a hair color or a hat is worn; and its
   * smoothed extent around the face (lib/tryon/hairFit.ts), which hats are sized to.
   */
  hair: { present: false, above: 0, width: 0 },
};

/** Reads one blendshape score by name; caches its index (the category order is fixed by the model). */
const blendshapeIndex = new Map<string, number>();
export function blendshapeScore(categories: readonly { categoryName: string; score: number }[], name: string): number {
  let i = blendshapeIndex.get(name);
  if (i === undefined || categories[i]?.categoryName !== name) {
    i = categories.findIndex((c) => c.categoryName === name);
    blendshapeIndex.set(name, i);
  }
  return i >= 0 ? categories[i].score : 0;
}

/** Copies FaceLandmarker landmarks into a flat, preallocated array (no allocation per frame). */
export function copyLandmarks(landmarks: readonly { x: number; y: number; z: number }[], out: Float32Array) {
  const n = Math.min(landmarks.length, out.length / 3);
  for (let i = 0; i < n; i++) {
    const l = landmarks[i];
    out[i * 3] = l.x;
    out[i * 3 + 1] = l.y;
    out[i * 3 + 2] = l.z;
  }
}
