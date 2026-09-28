export type FrameFinish = "matte" | "metal" | "glass";
export type LensEffect = "clear" | "iridescent" | "holographic";

export type ProductConfig = {
  finish: FrameFinish;
  /** CSS hex color, e.g. "#1f2937". */
  frameColor: string;
  lens: LensEffect;
};

/** Per-product adjustment applied on top of face-landmark anchoring in TRY_ON. */
export type TryOnCalibration = {
  /** Offset in face-anchor space [x, y, z]. */
  offset: [number, number, number];
  scale: number;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  /** Path under /public/models. */
  model: string;
  defaultConfig: ProductConfig;
  calibration: TryOnCalibration;
};

export const PRODUCTS: readonly Product[] = [
  {
    id: "aviator",
    name: "Aviator",
    price: 149,
    model: "/models/glasses.glb",
    defaultConfig: { finish: "metal", frameColor: "#c9a44c", lens: "clear" },
    calibration: { offset: [0, 0, 0], scale: 1 },
  },
  {
    id: "studio",
    name: "Studio",
    price: 129,
    model: "/models/glasses.glb",
    defaultConfig: { finish: "matte", frameColor: "#111827", lens: "clear" },
    calibration: { offset: [0, 0, 0], scale: 1 },
  },
  {
    id: "crystal",
    name: "Crystal",
    price: 179,
    model: "/models/glasses.glb",
    defaultConfig: { finish: "glass", frameColor: "#7c3aed", lens: "iridescent" },
    calibration: { offset: [0, 0, 0], scale: 1 },
  },
];

export const DEFAULT_PRODUCT_ID = PRODUCTS[0].id;

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
