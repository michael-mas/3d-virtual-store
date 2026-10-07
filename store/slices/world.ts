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
  /** The visitor passed the welcome screen ("Enter the Maison"). */
  entered: boolean;
  setEntered: () => void;
  /** Ambient music (off by default; started from a user gesture). */
  musicOn: boolean;
  setMusicOn: (on: boolean) => void;
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
  /** Gallery work the player stands before in EXPLORE (null if none). */
  nearArtwork: string | null;
  setNearArtwork: (artworkId: string | null) => void;
  /** The player is in the gallery (past the entrance wall) in EXPLORE. */
  inGallery: boolean;
  setInGallery: (inGallery: boolean) => void;
  /** The gallery passport's stamps (artwork ids, in the order they were earned). */
  stamps: string[];
  addStamp: (artworkId: string) => void;
  setStamps: (stamps: string[]) => void;
  /** The gallery's performance is playing, and whether the director's camera has the view. */
  showPlaying: boolean;
  showCinema: boolean;
  setShow: (state: Partial<{ showPlaying: boolean; showCinema: boolean }>) => void;
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
  entered: false,
  setEntered: () => set({ entered: true }),
  musicOn: false,
  setMusicOn: (musicOn) => set({ musicOn }),
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
  nearArtwork: null,
  setNearArtwork: (nearArtwork) => {
    if (get().nearArtwork !== nearArtwork) set({ nearArtwork });
  },
  stamps: [],
  addStamp: (id) => {
    if (!get().stamps.includes(id)) set({ stamps: [...get().stamps, id] });
  },
  setStamps: (stamps) => set({ stamps }),
  showPlaying: false,
  showCinema: false,
  setShow: (state) => set(state),
  inGallery: false,
  setInGallery: (inGallery) => {
    if (get().inGallery !== inGallery) set({ inGallery });
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
    // The demo / photo source and looks last for one try-on session.
    if (!isTryOnMode(to) && get().tryOnSource !== "camera") set({ tryOnSource: "camera", tryOnImage: null });
    if (!isTryOnMode(to) && get().look) set({ look: null });
    return true;
  },
});
