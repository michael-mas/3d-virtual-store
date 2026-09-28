import type { Slice } from "./types";

export type TryOnStatus = "idle" | "starting" | "running" | "error";

export type TryOnSlice = {
  tryOnStatus: TryOnStatus;
  tryOnError: string | null;
  /** Object URL / data URL of the last captured photo (PHOTO mode). */
  photoUrl: string | null;
  /** Webcam frame aspect (width / height); sizes the try-on stage so the 3D camera matches the video. */
  videoAspect: number | null;
  faceDetected: boolean;
  setTryOnStatus: (status: TryOnStatus, error?: string) => void;
  setPhotoUrl: (url: string | null) => void;
  setVideoAspect: (aspect: number) => void;
  setFaceDetected: (detected: boolean) => void;
};

export const createTryOnSlice: Slice<TryOnSlice> = (set) => ({
  tryOnStatus: "idle",
  tryOnError: null,
  photoUrl: null,
  videoAspect: null,
  faceDetected: false,
  setTryOnStatus: (tryOnStatus, error) => set({ tryOnStatus, tryOnError: error ?? null }),
  setPhotoUrl: (photoUrl) =>
    set((s) => {
      // Photos are object URLs; release the previous one.
      if (s.photoUrl && s.photoUrl !== photoUrl) URL.revokeObjectURL(s.photoUrl);
      return { photoUrl };
    }),
  setVideoAspect: (videoAspect) => set({ videoAspect }),
  setFaceDetected: (faceDetected) => set({ faceDetected }),
});
