import { glassesProduct } from "./glasses";
import { facePaintProduct } from "./facePaint";
import { hairDyeProduct } from "./hairDye";
import { headwearProduct } from "./headwear";
import { lipstickProduct } from "./lipstick";
import { ringProduct } from "./ring";
import { watchProduct } from "./watch";
import { TRY_ON_ZONES, type Product, type Tracker } from "./types";

export type * from "./types";
export * from "./schema";
export { TRY_ON_ZONES } from "./types";

/**
 * The product registry. Adding a product = one entry here (plus its assets). The customizer, cart pricing,
 * pedestal placement (in registry order, see lib/explore/layout.ts) and rendering are derived from it.
 */
export const PRODUCTS: readonly Product[] = [
  glassesProduct({
    id: "aviator",
    name: "Aviator",
    basePrice: 149,
    model: "/models/glasses-aviator.glb",
    defaults: { finish: "metal", frameColor: "#c9a44c", lens: "clear" },
  }),
  glassesProduct({
    id: "studio",
    name: "Studio",
    basePrice: 129,
    model: "/models/glasses-studio.glb",
    defaults: { finish: "matte", frameColor: "#111827", lens: "clear" },
  }),
  glassesProduct({
    id: "crystal",
    name: "Crystal",
    basePrice: 179,
    model: "/models/glasses-crystal.glb",
    defaults: { finish: "glass", frameColor: "#7c3aed", lens: "iridescent" },
  }),
  lipstickProduct({ id: "velvet-lip", name: "Velvet Lip", basePrice: 32 }),
  facePaintProduct({ id: "glow-paint", name: "Glow Paint", basePrice: 24 }),
  watchProduct({ id: "chrono", name: "Chrono", basePrice: 249 }),
  ringProduct({ id: "solitaire", name: "Solitaire", basePrice: 189 }),
  hairDyeProduct({ id: "prism-dye", name: "Prism Dye", basePrice: 29 }),
  headwearProduct({ id: "topper", name: "Topper", basePrice: 39 }),
];

export const DEFAULT_PRODUCT_ID = PRODUCTS[0].id;

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** The MediaPipe tracker that follows a product in try-on (from its zone). */
export function productTracker(id: string): Tracker | undefined {
  const zone = getProduct(id)?.zone;
  return TRY_ON_ZONES.find((z) => z.id === zone)?.tracker;
}
