import type { OptionSchema, Product } from "./types";

export const WATCH_CASES = ["steel", "gold", "black"] as const;
export const WATCH_STRAPS = ["brown-leather", "black-leather", "steel", "blue-rubber"] as const;
export type WatchCase = (typeof WATCH_CASES)[number];
export type WatchStrap = (typeof WATCH_STRAPS)[number];

/** Customization schema shared by every watch product. */
export const WATCH_OPTIONS: readonly OptionSchema[] = [
  {
    kind: "choice",
    id: "case",
    label: "Case",
    default: "steel",
    values: [
      { value: "steel", label: "Steel" },
      { value: "gold", label: "Gold", priceDelta: 60 },
      { value: "black", label: "Black", priceDelta: 30 },
    ],
  },
  {
    kind: "color",
    id: "dial",
    label: "Dial",
    default: "#14213d",
    allowCustom: true,
    presets: [
      { value: "#14213d", label: "Navy" },
      { value: "#111111", label: "Black" },
      { value: "#f4f1ea", label: "White" },
      { value: "#1f5136", label: "Green" },
      { value: "#e8a48f", label: "Salmon" },
    ],
  },
  {
    kind: "choice",
    id: "strap",
    label: "Strap",
    default: "brown-leather",
    values: [
      { value: "brown-leather", label: "Brown leather" },
      { value: "black-leather", label: "Black leather" },
      { value: "steel", label: "Metal bracelet", priceDelta: 40 },
      { value: "blue-rubber", label: "Blue rubber" },
    ],
  },
];

/** Typed view of a (validated) watch configuration. */
export type WatchConfig = { case: WatchCase; dial: string; strap: WatchStrap };
export const readWatchConfig = (c: Readonly<Record<string, string>>): WatchConfig => ({
  case: c.case as WatchCase,
  dial: c.dial,
  strap: c.strap as WatchStrap,
});

/** A watch: worn on the wrist, pinned to the tracked hand (HandLandmarker). */
export function watchProduct(p: { id: string; name: string; basePrice: number }): Product {
  return {
    id: p.id,
    name: p.name,
    category: "watch",
    attachment: "landmark",
    zone: "wrist",
    renderer: "watch",
    basePrice: p.basePrice,
    options: WATCH_OPTIONS,
    // Placed from the hand landmarks (lib/tryon/handPose.ts); no face-anchor calibration.
    calibration: { offset: [0, 0, 0], scale: 1 },
  };
}
