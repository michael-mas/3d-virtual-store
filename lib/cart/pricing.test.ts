import { describe, expect, it } from "vitest";
import { DEFAULT_PRODUCT_ID, getProduct } from "@/lib/products";
import { formatPrice, priceBreakdown, priceOf, PRICE_TABLE } from "./pricing";

const base = getProduct(DEFAULT_PRODUCT_ID)!.price;

describe("pricing", () => {
  it("adds finish and lens surcharges to the base price", () => {
    const b = priceBreakdown(DEFAULT_PRODUCT_ID, { finish: "glass", frameColor: "#000000", lens: "holographic" });
    expect(b).toEqual({
      base,
      finish: PRICE_TABLE.finish.glass,
      lens: PRICE_TABLE.lens.holographic,
      total: base + PRICE_TABLE.finish.glass + PRICE_TABLE.lens.holographic,
    });
  });

  it("does not depend on frame color", () => {
    const a = priceOf(DEFAULT_PRODUCT_ID, { finish: "metal", frameColor: "#000000", lens: "clear" });
    const b = priceOf(DEFAULT_PRODUCT_ID, { finish: "metal", frameColor: "#ff0000", lens: "clear" });
    expect(a).toBe(b);
  });

  it("formats USD", () => {
    expect(formatPrice(149)).toBe("$149.00");
  });
});
