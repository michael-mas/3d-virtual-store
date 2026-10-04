import type { OptionSchema, Product } from "./types";

export const LIP_FINISHES = ["matte", "satin", "gloss", "metallic"] as const;
export type LipFinish = (typeof LIP_FINISHES)[number];

/** Customization schema shared by every lipstick product. */
export const LIPSTICK_OPTIONS: readonly OptionSchema[] = [
  {
    kind: "choice",
    id: "finish",
    label: "Finish",
    default: "satin",
    values: [
      { value: "matte", label: "Matte" },
      { value: "satin", label: "Satin", priceDelta: 4 },
      { value: "gloss", label: "Gloss", priceDelta: 6 },
      { value: "metallic", label: "Metallic", priceDelta: 9 },
    ],
  },
  {
    kind: "color",
    id: "color",
    label: "Shade",
    default: "#b3123a",
    allowCustom: true,
    presets: [
      { value: "#b3123a", label: "Ruby" },
      { value: "#d9546e", label: "Rose" },
      { value: "#c2685a", label: "Nude" },
      { value: "#8e2f4a", label: "Berry" },
      { value: "#5e1a3b", label: "Plum" },
      { value: "#e0562b", label: "Coral" },
    ],
  },
];

/** Typed view of a (validated) lipstick configuration. */
export type LipstickConfig = { finish: LipFinish; color: string };
export const readLipstickConfig = (c: Readonly<Record<string, string>>): LipstickConfig => ({
  finish: c.finish as LipFinish,
  color: c.color,
});

/** A lipstick product: drawn on the lips by the surface try-on layer. */
export function lipstickProduct(p: {
  id: string;
  name: string;
  basePrice: number;
  defaults?: Partial<LipstickConfig>;
}): Product {
  return {
    id: p.id,
    name: p.name,
    category: "lips",
    attachment: "surface",
    zone: "lips",
    renderer: "lipstick",
    basePrice: p.basePrice,
    options: LIPSTICK_OPTIONS.map((o) => {
      const d = (p.defaults as Record<string, string | undefined> | undefined)?.[o.id];
      return d ? { ...o, default: d } : o;
    }),
    // Surface products follow the face mesh directly; no offset/scale.
    calibration: { offset: [0, 0, 0], scale: 1 },
  };
}
