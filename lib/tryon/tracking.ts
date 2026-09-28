import { Matrix4 } from "three";

/**
 * Per-frame try-on state shared between the DOM session (webcam + FaceLandmarker) and the R3F scene.
 * Kept outside React/zustand: it changes at video frame rate.
 */
export const tracking = {
  /** Playing webcam element while a session is running. */
  video: null as HTMLVideoElement | null,
  /** Smoothed facial transformation matrix (canonical face cm → camera cm). */
  pose: new Matrix4(),
  hasFace: false,
};
