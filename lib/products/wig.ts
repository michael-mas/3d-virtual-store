import type { OptionSchema, Product } from "./types";

export const WIG_STYLES = ["bob", "long", "afro"] as const;
export type WigStyle = (typeof WIG_STYLES)[number];

/** Customization schema shared by every wig product. The style changes the shape. */
export const WIG_OPTIONS: readonly OptionSchema[] = [
  {
    kind: "choice",
    id: "style",
    label: "Style",
    default: "bob",
    values: [
      { value: "bob", label: "Bob" },
      { value: "long", label: "Long waves", priceDelta: 15 },
      { value: "afro", label: "Afro", priceDelta: 10 },
    ],
  },
  {
    kind: "color",
    id: "color",
    label: "Color",
    default: "#5a3825",
    allowCustom: true,
    presets: [
      { value: "#1a1412", label: "Black" },
      { value: "#5a3825", label: "Chestnut" },
      { value: "#c9a063", label: "Honey blonde" },
      { value: "#e6dccb", label: "Platinum" },
      { value: "#8a3324", label: "Auburn" },
      { value: "#e87ea1", label: "Pink" },
      { value: "#3a6ee8", label: "Blue" },
    ],
  },
];

/** Typed view of a (validated) wig configuration. */
export type WigConfig = { style: WigStyle; color: string };
export const readWigConfig = (c: Readonly<Record<string, string>>): WigConfig => ({
  style: c.style as WigStyle,
  color: c.color,
});

/** A wig: stylized hair following the head pose (rigid attachment, face tracking); one per look with hats. */
export function wigProduct(p: { id: string; name: string; basePrice: number }): Product {
  return {
    id: p.id,
    name: p.name,
    category: "wig",
    attachment: "rigid",
    zone: "head",
    renderer: "wig",
    basePrice: p.basePrice,
    options: WIG_OPTIONS,
    calibration: { offset: [0, 0, 0], scale: 1 },
  };
}
