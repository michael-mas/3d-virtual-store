import type { Slice } from "./types";

export type TryOnStatus = "idle" | "starting" | "running" | "error";

export type TryOnSlice = {
  tryOnStatus: TryOnStatus;
  tryOnError: string | null;
  /** Object URL / data URL of the last captured photo (PHOTO mode). */
  photoUrl: string | null;
  setTryOnStatus: (status: TryOnStatus, error?: string) => void;
  setPhotoUrl: (url: string | null) => void;
};

export const createTryOnSlice: Slice<TryOnSlice> = (set) => ({
  tryOnStatus: "idle",
  tryOnError: null,
  photoUrl: null,
  setTryOnStatus: (tryOnStatus, error) => set({ tryOnStatus, tryOnError: error ?? null }),
  setPhotoUrl: (photoUrl) => set({ photoUrl }),
});
