import type { OptionSchema, Product } from "./types";

export const HAIR_FINISHES = ["natural", "vivid", "pastel"] as const;
export type HairFinish = (typeof HAIR_FINISHES)[number];

/** Customization schema shared by every hair color product. */
export const HAIR_DYE_OPTIONS: readonly OptionSchema[] = [
  {
    kind: "color",
    id: "color",
    label: "Color",
    default: "#e0559b",
    allowCustom: true,
    presets: [
      { value: "#e0559b", label: "Rose" },
      { value: "#b5541c", label: "Copper" },
      { value: "#e8dcc0", label: "Platinum" },
      { value: "#2563eb", label: "Electric blue" },
      { value: "#7c3aed", label: "Violet" },
      { value: "#3fbf9b", label: "Mint" },
      { value: "#141414", label: "Jet black" },
    ],
  },
  {
    kind: "choice",
    id: "finish",
    label: "Finish",
    default: "vivid",
    values: [
      { value: "natural", label: "Natural" },
      { value: "vivid", label: "Vivid", priceDelta: 5 },
      { value: "pastel", label: "Pastel", priceDelta: 5 },
    ],
  },
  { kind: "range", id: "intensity", label: "Intensity", min: 0.3, max: 1, step: 0.05, displayScale: 100, unit: "%", default: "0.85" },
];

/** Typed view of a (validated) hair color configuration. */
export type HairDyeConfig = { color: string; finish: HairFinish; intensity: number };
export const readHairDyeConfig = (c: Readonly<Record<string, string>>): HairDyeConfig => ({
  color: c.color,
  finish: c.finish as HairFinish,
  intensity: Number(c.intensity),
});

/**
 * How each finish applies the dye (lib/tryon/videoLayer.ts hairLayer): natural keeps the hair's lightness,
 * vivid lifts dark hair as if bleached first, pastel lifts and softens toward a light tone.
 */
export const HAIR_FINISH_LOOK: Record<HairFinish, { lift: number; pastel: number }> = {
  natural: { lift: 0.15, pastel: 0 },
  vivid: { lift: 0.85, pastel: 0 },
  pastel: { lift: 0.7, pastel: 0.55 },
};

/** A hair color: recolors the hair the segmenter finds in the video frame. */
export function hairDyeProduct(p: { id: string; name: string; basePrice: number }): Product {
  return {
    id: p.id,
    name: p.name,
    category: "hair-color",
    attachment: "segmentation",
    zone: "hair",
    renderer: "hairDye",
    basePrice: p.basePrice,
    options: HAIR_DYE_OPTIONS,
    calibration: { offset: [0, 0, 0], scale: 1 },
  };
}
