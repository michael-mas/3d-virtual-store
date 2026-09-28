import {
  DEFAULT_PRODUCT_ID,
  PRODUCTS,
  type FrameFinish,
  type LensEffect,
  type ProductConfig,
  type TryOnCalibration,
} from "@/lib/products";
import type { Slice } from "./types";

export type ProductSlice = {
  activeProductId: string;
  /** Current configuration per product id (kept when switching products). */
  configs: Record<string, ProductConfig>;
  /** Try-on calibration per product id. */
  calibrations: Record<string, TryOnCalibration>;
  selectProduct: (id: string) => void;
  setFinish: (finish: FrameFinish) => void;
  setFrameColor: (color: string) => void;
  setLensEffect: (lens: LensEffect) => void;
  setCalibration: (id: string, calibration: Partial<TryOnCalibration>) => void;
  /** Selects `id` and replaces its configuration (e.g. restoring a cart item). */
  applyConfig: (id: string, config: ProductConfig) => void;
};

export const createProductSlice: Slice<ProductSlice> = (set, get) => {
  const updateActiveConfig = (patch: Partial<ProductConfig>) => {
    const id = get().activeProductId;
    set((s) => ({ configs: { ...s.configs, [id]: { ...s.configs[id], ...patch } } }));
  };

  return {
    activeProductId: DEFAULT_PRODUCT_ID,
    configs: Object.fromEntries(PRODUCTS.map((p) => [p.id, { ...p.defaultConfig }])),
    calibrations: Object.fromEntries(
      PRODUCTS.map((p) => [p.id, { ...p.calibration, offset: [...p.calibration.offset] }]),
    ),
    selectProduct: (id) => {
      if (!(id in get().configs)) return;
      set({ activeProductId: id });
    },
    setFinish: (finish) => updateActiveConfig({ finish }),
    setFrameColor: (frameColor) => updateActiveConfig({ frameColor }),
    setLensEffect: (lens) => updateActiveConfig({ lens }),
    applyConfig: (id, config) => {
      if (!(id in get().configs)) return;
      set((s) => ({ activeProductId: id, configs: { ...s.configs, [id]: { ...config } } }));
    },
    setCalibration: (id, calibration) =>
      set((s) =>
        id in s.calibrations
          ? { calibrations: { ...s.calibrations, [id]: { ...s.calibrations[id], ...calibration } } }
          : {},
      ),
  };
};
