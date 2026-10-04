import {
  DEFAULT_PRODUCT_ID,
  defaultConfig,
  getProduct,
  isValidValue,
  PRODUCTS,
  sanitizeConfig,
  type ProductConfig,
  type TryOnCalibration,
} from "@/lib/products";
import type { Slice } from "./types";

export type ProductSlice = {
  activeProductId: string;
  /** Current configuration per product id (kept when switching products). Always schema-valid. */
  configs: Record<string, ProductConfig>;
  /** Try-on calibration per product id. */
  calibrations: Record<string, TryOnCalibration>;
  selectProduct: (id: string) => void;
  /** Sets one schema option on the active product; invalid options/values are ignored. */
  setOption: (optionId: string, value: string) => void;
  setCalibration: (id: string, calibration: Partial<TryOnCalibration>) => void;
  /** Selects `id` and replaces its configuration (e.g. restoring a cart item). */
  applyConfig: (id: string, config: ProductConfig) => void;
  /** Replaces `id`'s configuration without selecting it (e.g. wearing a cart item in a look). */
  setConfig: (id: string, config: ProductConfig) => void;
};

export const createProductSlice: Slice<ProductSlice> = (set, get) => ({
  activeProductId: DEFAULT_PRODUCT_ID,
  configs: Object.fromEntries(PRODUCTS.map((p) => [p.id, defaultConfig(p)])),
  calibrations: Object.fromEntries(
    PRODUCTS.map((p) => [p.id, { ...p.calibration, offset: [...p.calibration.offset] }]),
  ),
  selectProduct: (id) => {
    if (!(id in get().configs)) return;
    set({ activeProductId: id });
  },
  setOption: (optionId, value) => {
    const id = get().activeProductId;
    const option = getProduct(id)?.options.find((o) => o.id === optionId);
    if (!option || !isValidValue(option, value)) return;
    set((s) => ({ configs: { ...s.configs, [id]: { ...s.configs[id], [optionId]: value } } }));
  },
  applyConfig: (id, config) => {
    if (!getProduct(id)) return;
    get().setConfig(id, config);
    set({ activeProductId: id });
  },
  setConfig: (id, config) => {
    const product = getProduct(id);
    if (!product) return;
    set((s) => ({ configs: { ...s.configs, [id]: sanitizeConfig(product, config) } }));
  },
  setCalibration: (id, calibration) =>
    set((s) =>
      id in s.calibrations
        ? { calibrations: { ...s.calibrations, [id]: { ...s.calibrations[id], ...calibration } } }
        : {},
    ),
});
