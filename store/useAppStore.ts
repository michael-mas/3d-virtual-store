import { create } from "zustand";

export type RenderBackend = "WebGPU" | "WebGL2";

type AppState = {
  /** Active WebGPURenderer backend; null until `renderer.init()` resolves. */
  backend: RenderBackend | null;
  setBackend: (backend: RenderBackend) => void;
};

export const useAppStore = create<AppState>()((set) => ({
  backend: null,
  setBackend: (backend) => set({ backend }),
}));
