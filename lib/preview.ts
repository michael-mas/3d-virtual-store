import { getProduct } from "@/lib/products";

/**
 * Mannequin head used to preview surface products where there is no webcam (CUSTOMIZE, cart thumbnails).
 * Built from the canonical face (centimeters); its neck base rests on the pedestal top.
 */
export const MANNEQUIN_SCALE = 0.7;
/** Canonical y (cm) of the bottom of the mannequin's neck. */
export const MANNEQUIN_NECK_BOTTOM_CM = -17;
/** Pedestal top relative to a product origin (m), see `pedestal.productOffsetY` in showroom-layout.json. */
const PEDESTAL_TOP_Y = -0.024;
/** Height of the mannequin's face center (canonical origin) above the product origin (m). */
export const MANNEQUIN_FACE_Y = -MANNEQUIN_NECK_BOTTOM_CM * 0.01 * MANNEQUIN_SCALE + PEDESTAL_TOP_Y;

/**
 * Where the CUSTOMIZE camera should look, relative to the product origin, and how much farther it should stand:
 * surface products are previewed on the mannequin and hats on a hat block (a head, higher and larger than a pair of
 * glasses).
 */
export function previewFraming(productId: string): { liftY: number; distanceScale: number } {
  const product = getProduct(productId);
  if (product?.attachment === "surface") return { liftY: MANNEQUIN_FACE_Y, distanceScale: 1.35 };
  // Hats are shown on a head-sized hat block.
  if (product?.zone === "head") return { liftY: 0.13, distanceScale: 1.7 };
  return { liftY: 0, distanceScale: 1 };
}
