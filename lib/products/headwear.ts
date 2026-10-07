import type { OptionSchema, Product } from "./types";

export const HEADWEAR_STYLES = ["fedora", "beanie", "bucket"] as const;
export type HeadwearStyle = (typeof HEADWEAR_STYLES)[number];

/** Customization schema shared by every headwear product. The style changes the shape. */
export const HEADWEAR_OPTIONS: readonly OptionSchema[] = [
  {
    kind: "choice",
    id: "style",
    label: "Style",
    default: "fedora",
    values: [
      { value: "fedora", label: "Fedora", priceDelta: 20 },
      { value: "beanie", label: "Beanie" },
      { value: "bucket", label: "Bucket hat", priceDelta: 5 },
    ],
  },
  {
    kind: "color",
    id: "color",
    label: "Color",
    default: "#1e3a5f",
    allowCustom: true,
    presets: [
      { value: "#1e3a5f", label: "Navy" },
      { value: "#151515", label: "Black" },
      { value: "#e9e1d0", label: "Cream" },
      { value: "#a4161a", label: "Red" },
      { value: "#2d5a3d", label: "Forest" },
      { value: "#d4a017", label: "Mustard" },
    ],
  },
  {
    kind: "color",
    id: "accent",
    label: "Accent",
    default: "#151515",
    allowCustom: true,
    presets: [
      { value: "#f2f2f2", label: "White" },
      { value: "#151515", label: "Black" },
      { value: "#a4161a", label: "Red" },
      { value: "#d4a017", label: "Mustard" },
    ],
  },
];

/** Typed view of a (validated) headwear configuration. */
export type HeadwearConfig = { style: HeadwearStyle; color: string; accent: string };
export const readHeadwearConfig = (c: Readonly<Record<string, string>>): HeadwearConfig => ({
  style: c.style as HeadwearStyle,
  color: c.color,
  accent: c.accent,
});

/** A hat: a 3D model following the head pose, like glasses (rigid attachment, face tracking). */
export function headwearProduct(p: { id: string; name: string; basePrice: number }): Product {
  return {
    id: p.id,
    name: p.name,
    category: "headwear",
    attachment: "rigid",
    zone: "head",
    renderer: "headwear",
    basePrice: p.basePrice,
    options: HEADWEAR_OPTIONS,
    calibration: { offset: [0, 0, 0], scale: 1 },
  };
}
