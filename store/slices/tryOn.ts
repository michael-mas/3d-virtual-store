import type { TryOnError } from "@/lib/tryon/errors";
import type { Slice } from "./types";

/** idle → camera (opening the video source) → model (loading face tracking) → running; any step may → error. */
export type TryOnStatus = "idle" | "camera" | "model" | "running" | "error";

/** Webcam, or the bundled sample video run through the same pipeline. */
export type TryOnSource = "camera" | "demo";

/** Debug view of the surface (face mesh) layer: canonical-UV checker or the underlying video luminance. */
export type SurfaceDebug = "off" | "uv" | "luma";

export type TryOnSlice = {
  tryOnStatus: TryOnStatus;
  tryOnError: TryOnError | null;
  tryOnSource: TryOnSource;
  /** Bumped to restart the session (retry). */
  tryOnAttempt: number;
  /** Object URL / data URL of the last captured photo (PHOTO mode). */
  photoUrl: string | null;
  /** Webcam frame aspect (width / height); sizes the try-on stage so the 3D camera matches the video. */
  videoAspect: number | null;
  /** A face was tracked recently (within the grace period). */
  faceDetected: boolean;
  /** A hand was tracked recently (within the grace period); only tracked when a hand product is worn. */
  handDetected: boolean;
  /** Face-tracking download progress (0..1) while status is "model"; null otherwise. */
  tryOnProgress: number | null;
  surfaceDebug: SurfaceDebug;
  setSurfaceDebug: (mode: SurfaceDebug) => void;
  setTryOnProgress: (progress: number | null) => void;
  setTryOnStatus: (status: TryOnStatus, error?: TryOnError) => void;
  setTryOnSource: (source: TryOnSource) => void;
  retryTryOn: () => void;
  setPhotoUrl: (url: string | null) => void;
  setVideoAspect: (aspect: number) => void;
  setFaceDetected: (detected: boolean) => void;
  setHandDetected: (detected: boolean) => void;
};

export const createTryOnSlice: Slice<TryOnSlice> = (set) => ({
  tryOnStatus: "idle",
  tryOnError: null,
  tryOnSource: "camera",
  tryOnAttempt: 0,
  photoUrl: null,
  videoAspect: null,
  faceDetected: false,
  handDetected: false,
  tryOnProgress: null,
  surfaceDebug: "off",
  setSurfaceDebug: (surfaceDebug) => set({ surfaceDebug }),
  setTryOnProgress: (tryOnProgress) => set({ tryOnProgress }),
  setTryOnStatus: (tryOnStatus, error) => set({ tryOnStatus, tryOnError: error ?? null }),
  setTryOnSource: (tryOnSource) => set((s) => ({ tryOnSource, tryOnAttempt: s.tryOnAttempt + 1 })),
  retryTryOn: () => set((s) => ({ tryOnAttempt: s.tryOnAttempt + 1 })),
  setPhotoUrl: (photoUrl) =>
    set((s) => {
      // Photos are object URLs; release the previous one.
      if (s.photoUrl && s.photoUrl !== photoUrl) URL.revokeObjectURL(s.photoUrl);
      return { photoUrl };
    }),
  setVideoAspect: (videoAspect) => set({ videoAspect }),
  setFaceDetected: (faceDetected) => {
    set((s) => (s.faceDetected === faceDetected ? s : { faceDetected }));
  },
  setHandDetected: (handDetected) => {
    set((s) => (s.handDetected === handDetected ? s : { handDetected }));
  },
});
