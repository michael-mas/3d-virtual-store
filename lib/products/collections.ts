import { isValidValue } from "./schema";
import type { ChoiceOption, Product, ProductCategory, ProductConfig } from "./types";

/**
 * The house's collections, offered on every piece. "Atelier" is the piece as configured; the Gold and Mirror
 * collections are unlocked in the gallery (the passport: lib/gallery/passport.ts) and give every piece its own
 * reading of gold or of the mirror: each sets some of the piece's options (a gold frame, a polished steel case, a
 * metallic lip…), which the customizer then shows as set by the collection.
 */

export const COLLECTIONS = ["atelier", "or", "miroir"] as const;
export type Collection = (typeof COLLECTIONS)[number];
/** The collections the passport unlocks. */
export type LockedCollection = Exclude<Collection, "atelier">;

const GOLD = "#d4af37";
const MIRROR = "#e4e7ec";

/** What each collection sets, per category (option id → value). */
const LOOKS: Record<ProductCategory, Record<LockedCollection, Record<string, string>>> = {
  eyewear: { or: { finish: "metal", frameColor: GOLD }, miroir: { finish: "metal", frameColor: MIRROR, lens: "iridescent" } },
  lips: { or: { finish: "metallic", color: "#b8863b" }, miroir: { finish: "metallic", color: "#c3c7cd" } },
  "face-paint": { or: { style: "paint", color: GOLD }, miroir: { style: "holographic", color: MIRROR } },
  watch: { or: { case: "gold", dial: GOLD }, miroir: { case: "steel", dial: MIRROR } },
  ring: { or: { metal: "yellow-gold", stone: "diamond" }, miroir: { metal: "platinum", stone: "diamond" } },
  "hair-color": { or: { color: "#c9a14a", finish: "vivid" }, miroir: { color: "#dfe3e8", finish: "vivid" } },
  headwear: { or: { color: "#151515", accent: GOLD }, miroir: { color: "#151515", accent: MIRROR } },
};

/** The collection option of a piece: its price rises with the piece's own (half / four fifths of it, to $5). */
export function collectionOption(basePrice: number): ChoiceOption {
  const delta = (k: number) => Math.max(5, Math.round((basePrice * k) / 5) * 5);
  return {
    kind: "choice",
    id: "collection",
    label: "Collection",
    default: "atelier",
    values: [
      { value: "atelier", label: "Atelier" },
      { value: "or", label: "Gold", priceDelta: delta(0.5), unlock: "or" },
      { value: "miroir", label: "Mirror", priceDelta: delta(0.8), unlock: "miroir" },
    ],
  };
}

/** The options a collection sets on a piece (only those valid for it). */
export function collectionOverrides(product: Product, collection: string | undefined): Record<string, string> {
  if (collection !== "or" && collection !== "miroir") return {};
  const look = LOOKS[product.category][collection];
  return Object.fromEntries(
    Object.entries(look).filter(([id, value]) => {
      const option = product.options.find((o) => o.id === id);
      return option !== undefined && isValidValue(option, value);
    }),
  );
}

/** The configuration as worn and rendered: the collection's settings over the visitor's own. */
export function lookConfig(product: Product | undefined, config: ProductConfig): ProductConfig {
  if (!product) return config;
  const overrides = collectionOverrides(product, config.collection);
  return Object.keys(overrides).length ? { ...config, ...overrides } : config;
}
