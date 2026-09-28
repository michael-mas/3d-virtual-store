import { glassesProduct } from "./glasses";
import type { Product } from "./types";

export type * from "./types";
export * from "./schema";

/**
 * The product registry. Adding a product = one entry here (plus its assets). The customizer, cart pricing,
 * pedestal placement (in registry order, see lib/explore/layout.ts) and rendering are derived from it.
 */
export const PRODUCTS: readonly Product[] = [
  glassesProduct({
    id: "aviator",
    name: "Aviator",
    basePrice: 149,
    model: "/models/glasses.glb",
    defaults: { finish: "metal", frameColor: "#c9a44c", lens: "clear" },
  }),
  glassesProduct({
    id: "studio",
    name: "Studio",
    basePrice: 129,
    model: "/models/glasses.glb",
    defaults: { finish: "matte", frameColor: "#111827", lens: "clear" },
  }),
  glassesProduct({
    id: "crystal",
    name: "Crystal",
    basePrice: 179,
    model: "/models/glasses.glb",
    defaults: { finish: "glass", frameColor: "#7c3aed", lens: "iridescent" },
  }),
];

export const DEFAULT_PRODUCT_ID = PRODUCTS[0].id;

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
