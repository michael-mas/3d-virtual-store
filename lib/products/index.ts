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
  {
    ...glassesProduct({
      id: "aviator",
      name: "L'Aviateur",
      basePrice: 149,
      model: "/models/glasses-aviator.glb",
      defaults: { finish: "metal", frameColor: "#c9a44c", lens: "clear" },
    }),
    tagline: "A double-bridge pilot frame, drawn in fine metal.",
  },
  {
    ...glassesProduct({
      id: "studio",
      name: "Atelier 03",
      basePrice: 129,
      model: "/models/glasses-studio.glb",
      defaults: { finish: "matte", frameColor: "#111827", lens: "clear" },
    }),
    tagline: "The square acetate frame of the house's third atelier.",
  },
  {
    ...glassesProduct({
      id: "crystal",
      name: "Cristal",
      basePrice: 179,
      model: "/models/glasses-crystal.glb",
      defaults: { finish: "glass", frameColor: "#7c3aed", lens: "iridescent" },
    }),
    tagline: "A cat-eye cut from translucent glass, for the evening.",
  },
  {
    ...lipstickProduct({ id: "velvet-lip", name: "Rouge Velours", basePrice: 32 }),
    tagline: "A lipstick in a gold case, from velvet matte to mirror gloss.",
  },
  {
    ...facePaintProduct({ id: "glow-paint", name: "Nuit Lumière", basePrice: 24 }),
    tagline: "Face art that glows brighter as you smile.",
  },
  {
    ...watchProduct({ id: "chrono", name: "Chrono Nuit", basePrice: 249 }),
    tagline: "A three-hand watch that keeps your time, to the second.",
  },
  {
    ...ringProduct({ id: "solitaire", name: "Solitaire", basePrice: 189 }),
    tagline: "A single stone, raised on four claws.",
  },
  {
    ...hairDyeProduct({ id: "prism-dye", name: "Prisme", basePrice: 29 }),
    tagline: "Color for your own hair, strand by strand, without a single drop.",
  },
  {
    ...headwearProduct({ id: "topper", name: "Le Chapeau", basePrice: 39 }),
    tagline: "A cap, a beanie or a bucket hat, cut to the head.",
  },
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
