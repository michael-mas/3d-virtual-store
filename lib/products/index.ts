import { glassesProduct } from "./glasses";
import { facePaintProduct } from "./facePaint";
import { hairDyeProduct } from "./hairDye";
import { headwearProduct } from "./headwear";
import { lipstickProduct } from "./lipstick";
import { ringProduct } from "./ring";
import { watchProduct } from "./watch";
import { collectionOption } from "./collections";
import { TRY_ON_ZONES, type Product, type Tracker } from "./types";

export type * from "./types";
export * from "./schema";
export * from "./collections";
export { CATEGORY_LABELS, TRY_ON_ZONES } from "./types";

/**
 * The product registry. Adding a product = one entry here (plus its assets). The customizer, cart pricing,
 * pedestal placement (in registry order, see lib/explore/layout.ts) and rendering are derived from it. Every piece
 * also gets the house's collection option (lib/products/collections.ts).
 */
const ENTRIES: readonly Product[] = [
  {
    ...glassesProduct({
      id: "aviator",
      name: "L'Aviateur",
      basePrice: 149,
      model: "/models/glasses-aviator.glb",
      defaults: { finish: "metal", frameColor: "#c9a44c", lens: "clear" },
    }),
    tagline: "A double-bridge pilot frame, drawn in fine metal.",
    tip: "L'Aviateur suits nearly every face. Gold metal with clear lenses is the daytime classic.",
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
    tip: "Atelier 03's square line balances round and oval faces. Matte black never fails.",
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
    tip: "Cristal is made for the evening: the glass finish catches the light. Try the iridescent lenses.",
  },
  {
    ...lipstickProduct({ id: "velvet-lip", name: "Rouge Velours", basePrice: 32 }),
    tagline: "A lipstick in a gold case, from velvet matte to mirror gloss.",
    tip: "Matte for the day, gloss for the evening. The try-on keeps the texture of your own lips.",
  },
  {
    ...facePaintProduct({ id: "glow-paint", name: "Nuit Lumière", basePrice: 24 }),
    tagline: "Face art that glows brighter as you smile.",
    tip: "Smile in the try-on: Nuit Lumière glows brighter. Neon on the constellation is the showpiece.",
  },
  {
    ...watchProduct({ id: "chrono", name: "Chrono Nuit", basePrice: 249 }),
    tagline: "A three-hand watch that keeps your time, to the second.",
    tip: "Chrono Nuit shows your real time. To try it, show the back of your hand to the camera.",
  },
  {
    ...ringProduct({ id: "solitaire", name: "Solitaire", basePrice: 189 }),
    tagline: "A single stone, raised on four claws.",
    tip: "Choose the finger first: the band size follows it. Then the metal, then the stone.",
  },
  {
    ...hairDyeProduct({ id: "prism-dye", name: "Prisme", basePrice: 29 }),
    tagline: "Color for your own hair, strand by strand, without a single drop.",
    tip: "Prisme colors your real hair. Vivid lifts dark hair as if bleached first.",
  },
  {
    ...headwearProduct({ id: "topper", name: "Le Chapeau", basePrice: 39 }),
    tagline: "A felt fedora, a beanie or a bucket hat, sized to your hair.",
    tip: "A cream beanie with L'Aviateur is a house favorite. Try them together from your selection.",
  },
];

export const PRODUCTS: readonly Product[] = ENTRIES.map((p) => ({ ...p, options: [...p.options, collectionOption(p.basePrice)] }));

export const DEFAULT_PRODUCT_ID = PRODUCTS[0].id;

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** The MediaPipe tracker that follows a product in try-on (from its zone). */
export function productTracker(id: string): Tracker | undefined {
  const zone = getProduct(id)?.zone;
  return TRY_ON_ZONES.find((z) => z.id === zone)?.tracker;
}
