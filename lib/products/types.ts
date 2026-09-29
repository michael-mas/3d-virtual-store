/**
 * Generic product model. A product is data: identity, how it attaches to the face in try-on, and a
 * customization schema from which the customizer UI, validation and cart pricing are all derived.
 */

export type ProductCategory = "eyewear" | "lips" | "face-paint";

/**
 * How a product follows the face in TRY_ON:
 * - rigid:    a 3D model driven by the facial transformation matrix (glasses, hats…)
 * - surface:  a texture/material on the deforming face mesh (lipstick, face paint…)
 * - landmark: an object pinned to individual landmarks (earrings, piercings…)
 */
export type AttachmentType = "rigid" | "surface" | "landmark";

export type OptionValue = {
  value: string;
  label: string;
  /** Added to the base price when selected. */
  priceDelta?: number;
};

/** Pick one of a fixed list. */
export type ChoiceOption = {
  kind: "choice";
  id: string;
  label: string;
  values: readonly OptionValue[];
  default: string;
};

/** A color: presets plus (optionally) any custom CSS hex color. Color never changes the price. */
export type ColorOption = {
  kind: "color";
  id: string;
  label: string;
  presets: readonly OptionValue[];
  allowCustom: boolean;
  default: string;
};

/** A number on a slider (stored as a decimal string, like every config value). Never changes the price. */
export type RangeOption = {
  kind: "range";
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Displayed value = value × displayScale, followed by unit (e.g. 0.8 → "80%"). */
  displayScale?: number;
  unit?: string;
  default: string;
};

export type OptionSchema = ChoiceOption | ColorOption | RangeOption;

/** Selected value per option id. Always validated against the product's schema. */
export type ProductConfig = Readonly<Record<string, string>>;

/** Per-product adjustment applied on top of face anchoring in TRY_ON. */
export type TryOnCalibration = {
  /** Offset in face-anchor space [x, y, z] (meters). */
  offset: [number, number, number];
  scale: number;
};

/** Which scene component renders the product (store display, CUSTOMIZE preview and try-on). */
export type ProductRenderer = "glasses" | "lipstick" | "facePaint";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  attachment: AttachmentType;
  basePrice: number;
  renderer: ProductRenderer;
  /** Model under /public/models (rigid products). */
  model?: string;
  options: readonly OptionSchema[];
  calibration: TryOnCalibration;
};
