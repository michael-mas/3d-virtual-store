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
export { CATEGORY_LABELS, TRY_ON_ZONES } from "./types";

/**
 * The product registry. Adding a product = one entry here (plus its assets). The customizer, cart pricing,
 * pedestal placement (in registry order, see lib/explore/layout.ts) and rendering are derived from it.
 */
export const PRODUCTS: readonly Product[] = [
  glassesProduct({
    id: "aviator",
    name: "L'Aviateur",
    basePrice: 149,
    model: "/models/glasses-aviator.glb",
    defaults: { finish: "metal", frameColor: "#c9a44c", lens: "clear" },
  }),
  glassesProduct({
    id: "studio",
    name: "Atelier 03",
    basePrice: 129,
    model: "/models/glasses-studio.glb",
    defaults: { finish: "matte", frameColor: "#111827", lens: "clear" },
  }),
  glassesProduct({
    id: "crystal",
    name: "Cristal",
    basePrice: 179,
    model: "/models/glasses-crystal.glb",
    defaults: { finish: "glass", frameColor: "#7c3aed", lens: "iridescent" },
  }),
  lipstickProduct({ id: "velvet-lip", name: "Rouge Velours", basePrice: 32 }),
  facePaintProduct({ id: "glow-paint", name: "Nuit Lumière", basePrice: 24 }),
  watchProduct({ id: "chrono", name: "Chrono Nuit", basePrice: 249 }),
  ringProduct({ id: "solitaire", name: "Solitaire", basePrice: 189 }),
  hairDyeProduct({ id: "prism-dye", name: "Prisme", basePrice: 29 }),
  headwearProduct({ id: "topper", name: "Le Chapeau", basePrice: 39 }),
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
