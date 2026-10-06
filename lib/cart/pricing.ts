import { getProduct, optionPriceDelta, optionValueLabel, type ProductConfig } from "@/lib/products";

export type PriceLine = { optionId: string; label: string; valueLabel: string; delta: number };
export type PriceBreakdown = { base: number; lines: PriceLine[]; total: number };

/** Base price + every option's price delta, straight from the product schema. */
export function priceBreakdown(productId: string, config: ProductConfig): PriceBreakdown {
  const product = getProduct(productId);
  if (!product) return { base: 0, lines: [], total: 0 };
  const lines = product.options.map((o) => ({
    optionId: o.id,
    label: o.label,
    valueLabel: optionValueLabel(o, config[o.id]),
    delta: optionPriceDelta(o, config[o.id]),
  }));
  return { base: product.basePrice, lines, total: product.basePrice + lines.reduce((s, l) => s + l.delta, 0) };
}

export const priceOf = (productId: string, config: ProductConfig) => priceBreakdown(productId, config).total;

const FORMATTERS = {
  en: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  fr: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" }),
} as const;
/** Prices are in US dollars; French formatting puts the symbol after ("149,00 $"). */
export const formatPrice = (amount: number, locale: keyof typeof FORMATTERS = "en") => FORMATTERS[locale].format(amount);
