import type { OptionSchema, Product, TryOnCalibration } from "./types";

export const FRAME_FINISHES = ["matte", "metal", "glass"] as const;
export const LENS_EFFECTS = ["clear", "iridescent", "holographic"] as const;
export type FrameFinish = (typeof FRAME_FINISHES)[number];
export type LensEffect = (typeof LENS_EFFECTS)[number];

/** Customization schema shared by every glasses product. */
export const GLASSES_OPTIONS: readonly OptionSchema[] = [
  {
    kind: "choice",
    id: "finish",
    label: "Frame finish",
    default: "metal",
    values: [
      { value: "matte", label: "Matte" },
      { value: "metal", label: "Metal", priceDelta: 20 },
      { value: "glass", label: "Glass", priceDelta: 35 },
    ],
  },
  {
    kind: "color",
    id: "frameColor",
    label: "Frame color",
    default: "#c9a44c",
    allowCustom: true,
    presets: [
      { value: "#111827", label: "Black" },
      { value: "#c9a44c", label: "Gold" },
      { value: "#b91c1c", label: "Red" },
      { value: "#1d4ed8", label: "Blue" },
      { value: "#e5e7eb", label: "Silver" },
      { value: "#7c3aed", label: "Violet" },
    ],
  },
  {
    kind: "choice",
    id: "lens",
    label: "Lens",
    default: "clear",
    values: [
      { value: "clear", label: "Clear" },
      { value: "iridescent", label: "Iridescent", priceDelta: 25 },
      { value: "holographic", label: "Holographic", priceDelta: 40 },
    ],
  },
];

/** Typed view of a (validated) glasses configuration for the renderer. */
export type GlassesConfig = { finish: FrameFinish; frameColor: string; lens: LensEffect };
export const readGlassesConfig = (c: Readonly<Record<string, string>>): GlassesConfig => ({
  finish: c.finish as FrameFinish,
  frameColor: c.frameColor,
  lens: c.lens as LensEffect,
});

const NO_CALIBRATION: TryOnCalibration = { offset: [0, 0, 0], scale: 1 };

/** A glasses product: the shared schema with per-product defaults. */
export function glassesProduct(p: {
  id: string;
  name: string;
  basePrice: number;
  model: string;
  defaults: Partial<GlassesConfig>;
  calibration?: TryOnCalibration;
}): Product {
  return {
    id: p.id,
    name: p.name,
    category: "eyewear",
    attachment: "rigid",
    zone: "eyewear",
    renderer: "glasses",
    basePrice: p.basePrice,
    model: p.model,
    options: GLASSES_OPTIONS.map((o) => {
      const d = (p.defaults as Record<string, string | undefined>)[o.id];
      return d ? { ...o, default: d } : o;
    }),
    calibration: p.calibration ?? NO_CALIBRATION,
  };
}
