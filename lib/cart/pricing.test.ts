import { describe, expect, it } from "vitest";
import { DEFAULT_PRODUCT_ID, getProduct } from "@/lib/products";
import { formatPrice, priceBreakdown, priceOf } from "./pricing";

const product = getProduct(DEFAULT_PRODUCT_ID)!;

describe("pricing", () => {
  it("adds every option's price delta from the schema to the base price", () => {
    const b = priceBreakdown(DEFAULT_PRODUCT_ID, { finish: "glass", frameColor: "#000000", lens: "holographic", collection: "atelier" });
    expect(b.base).toBe(product.basePrice);
    expect(b.lines.map((l) => [l.optionId, l.valueLabel, l.delta])).toEqual([
      ["finish", "Glass", 35],
      ["frameColor", "#000000", 0],
      ["lens", "Holographic", 40],
      ["collection", "Atelier", 0],
    ]);
    expect(b.total).toBe(product.basePrice + 35 + 40);
  });

  it("keeps the glasses prices unchanged by the registry migration", () => {
    expect(priceOf("aviator", { finish: "metal", frameColor: "#c9a44c", lens: "clear" })).toBe(169);
    expect(priceOf("aviator", { finish: "matte", frameColor: "#b91c1c", lens: "iridescent" })).toBe(174);
    expect(priceOf("aviator", { finish: "glass", frameColor: "#1d4ed8", lens: "holographic" })).toBe(224);
    expect(priceOf("crystal", { finish: "glass", frameColor: "#7c3aed", lens: "iridescent" })).toBe(239);
  });

  it("prices surface products from their own schema (lipstick finish)", () => {
    expect(priceOf("velvet-lip", { finish: "matte", color: "#b3123a" })).toBe(32);
    expect(priceOf("velvet-lip", { finish: "gloss", color: "#123456" })).toBe(38);
    expect(priceOf("velvet-lip", { finish: "metallic", color: "#b3123a" })).toBe(41);
  });

  it("does not depend on frame color", () => {
    const a = priceOf(DEFAULT_PRODUCT_ID, { finish: "metal", frameColor: "#000000", lens: "clear" });
    const b = priceOf(DEFAULT_PRODUCT_ID, { finish: "metal", frameColor: "#ff0000", lens: "clear" });
    expect(a).toBe(b);
  });

  it("formats USD", () => {
    expect(formatPrice(149)).toBe("$149.00");
    expect(formatPrice(149, "fr").replace(/\s/g, " ")).toBe("149,00 $");
  });
});
