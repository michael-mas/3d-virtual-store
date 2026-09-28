import { isTryOnMode, nextMode, type Mode, type ModeEvent } from "@/lib/modes";
import type { Slice } from "./types";

export type RenderBackend = "WebGPU" | "WebGL2";

export type FrameStats = {
  /** Average frames per second over the last sample window. */
  fps: number;
  /** Longest frame (ms) in the last sample window. */
  worstMs: number;
  /** Average GPU render time per frame (ms) from timestamp queries; null if unsupported. */
  gpuMs: number | null;
  /** Compiled shader programs; should stay flat when switching product options (all variants pre-warmed). */
  programs: number;
};

export type WorldSlice = {
  mode: Mode;
  /** Active WebGPURenderer backend; null until `renderer.init()` resolves. */
  backend: RenderBackend | null;
  setBackend: (backend: RenderBackend) => void;
  /** The first frame has been rendered (initial loading screen can go). */
  sceneReady: boolean;
  setSceneReady: () => void;
  /** Fatal rendering problem (no WebGPU/WebGL2, GPU device lost); shown instead of a blank canvas. */
  rendererError: string | null;
  setRendererError: (message: string | null) => void;
  /** TSL post-processing (CUSTOMIZE background dim) on/off, for A/B cost measurement. */
  postFx: boolean;
  setPostFx: (enabled: boolean) => void;
  frameStats: FrameStats | null;
  setFrameStats: (stats: FrameStats) => void;
  /** Product whose pedestal the player is standing near in EXPLORE (null if none). */
  nearPedestal: string | null;
  setNearPedestal: (productId: string | null) => void;
  /** Selects the product and fires INTERACT (EXPLORE → CUSTOMIZE). */
  interactWith: (productId: string) => boolean;
  /** Applies a mode event via the transition table. Returns false (and ignores it) if invalid. */
  transition: (event: ModeEvent) => boolean;
};

export const createWorldSlice: Slice<WorldSlice> = (set, get) => ({
  mode: "EXPLORE",
  backend: null,
  setBackend: (backend) => set({ backend }),
  sceneReady: false,
  setSceneReady: () => set({ sceneReady: true }),
  rendererError: null,
  setRendererError: (rendererError) => set({ rendererError }),
  postFx: true,
  setPostFx: (postFx) => set({ postFx }),
  frameStats: null,
  setFrameStats: (frameStats) => set({ frameStats }),
  nearPedestal: null,
  setNearPedestal: (nearPedestal) => {
    if (get().nearPedestal !== nearPedestal) set({ nearPedestal });
  },
  interactWith: (productId) => {
    if (get().mode !== "EXPLORE") return get().transition("INTERACT");
    get().selectProduct(productId);
    return get().transition("INTERACT");
  },
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
    if (to !== "PHOTO" && get().photoUrl) get().setPhotoUrl(null);
    // Demo mode lasts for one try-on session.
    if (!isTryOnMode(to) && get().tryOnSource !== "camera") set({ tryOnSource: "camera" });
    return true;
  },
});
