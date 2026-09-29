import type { OptionSchema, Product } from "./types";

export const FACE_PAINT_STYLES = ["paint", "neon", "holographic"] as const;
export type FacePaintStyle = (typeof FACE_PAINT_STYLES)[number];
export type FacePaintDesignId = "tiger" | "masquerade" | "constellation";

/** Customization schema of the face paint product. */
export const FACE_PAINT_OPTIONS: readonly OptionSchema[] = [
  {
    kind: "choice",
    id: "design",
    label: "Design",
    default: "tiger",
    values: [
      { value: "tiger", label: "Tiger" },
      { value: "masquerade", label: "Masquerade", priceDelta: 5 },
      { value: "constellation", label: "Constellation", priceDelta: 8 },
    ],
  },
  {
    kind: "choice",
    id: "style",
    label: "Style",
    default: "neon",
    values: [
      { value: "paint", label: "Paint" },
      { value: "neon", label: "Neon", priceDelta: 6 },
      { value: "holographic", label: "Holographic", priceDelta: 10 },
    ],
  },
  {
    kind: "color",
    id: "color",
    label: "Color",
    default: "#22d3ee",
    allowCustom: true,
    presets: [
      { value: "#22d3ee", label: "Cyan" },
      { value: "#e879f9", label: "Magenta" },
      { value: "#a3e635", label: "Lime" },
      { value: "#f59e0b", label: "Amber" },
      { value: "#f8fafc", label: "White" },
      { value: "#111827", label: "Black" },
    ],
  },
  { kind: "range", id: "opacity", label: "Opacity", min: 0.2, max: 1, step: 0.05, displayScale: 100, unit: "%", default: "0.85" },
];

/** Typed view of a (validated) face paint configuration. */
export type FacePaintConfig = { design: FacePaintDesignId; style: FacePaintStyle; color: string; opacity: number };
export const readFacePaintConfig = (c: Readonly<Record<string, string>>): FacePaintConfig => ({
  design: c.design as FacePaintDesignId,
  style: c.style as FacePaintStyle,
  color: c.color,
  opacity: Number(c.opacity),
});

/** A face paint product: UV-mapped designs drawn on the tracked face by the surface try-on layer. */
export function facePaintProduct(p: { id: string; name: string; basePrice: number }): Product {
  return {
    id: p.id,
    name: p.name,
    category: "face-paint",
    attachment: "surface",
    renderer: "facePaint",
    basePrice: p.basePrice,
    options: FACE_PAINT_OPTIONS,
    calibration: { offset: [0, 0, 0], scale: 1 },
  };
}
