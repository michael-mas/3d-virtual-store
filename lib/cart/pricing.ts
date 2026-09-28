import type { FrameFinish, LensEffect, ProductConfig } from "@/lib/products";
import { getProduct } from "@/lib/products";

/** Surcharges on top of the product's base price. */
export const PRICE_TABLE = {
  finish: { matte: 0, metal: 20, glass: 35 } satisfies Record<FrameFinish, number>,
  lens: { clear: 0, iridescent: 25, holographic: 40 } satisfies Record<LensEffect, number>,
} as const;

export type PriceBreakdown = { base: number; finish: number; lens: number; total: number };

export function priceBreakdown(productId: string, config: ProductConfig): PriceBreakdown {
  const base = getProduct(productId)?.price ?? 0;
  const finish = PRICE_TABLE.finish[config.finish];
  const lens = PRICE_TABLE.lens[config.lens];
  return { base, finish, lens, total: base + finish + lens };
}

export const priceOf = (productId: string, config: ProductConfig) => priceBreakdown(productId, config).total;

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatPrice = (amount: number) => formatter.format(amount);
