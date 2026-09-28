import { nextMode, type Mode, type ModeEvent } from "@/lib/modes";
import type { Slice } from "./types";

export type RenderBackend = "WebGPU" | "WebGL2";

export type WorldSlice = {
  mode: Mode;
  /** Active WebGPURenderer backend; null until `renderer.init()` resolves. */
  backend: RenderBackend | null;
  setBackend: (backend: RenderBackend) => void;
  /** Applies a mode event via the transition table. Returns false (and ignores it) if invalid. */
  transition: (event: ModeEvent) => boolean;
};

export const createWorldSlice: Slice<WorldSlice> = (set, get) => ({
  mode: "EXPLORE",
  backend: null,
  setBackend: (backend) => set({ backend }),
  transition: (event) => {
    const from = get().mode;
    const to = nextMode(from, event);
    if (to === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[transition] ignored invalid event ${event} in mode ${from}`);
      }
      return false;
    }
    set({ mode: to });
    return true;
  },
});
