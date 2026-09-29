import { describe, expect, it } from "vitest";
import { defaultConfig, getProduct, isValidValue, optionPriceDelta, optionValueLabel, PRODUCTS, sanitizeConfig } from "@/lib/products";

const aviator = getProduct("aviator")!;
const option = (id: string) => aviator.options.find((o) => o.id === id)!;

describe("product schema", () => {
  it("every registry entry has unique ids and valid defaults", () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    for (const p of PRODUCTS) for (const o of p.options) expect(isValidValue(o, o.default)).toBe(true);
  });

  it("keeps the glasses defaults of the previous model", () => {
    expect(defaultConfig(aviator)).toEqual({ finish: "metal", frameColor: "#c9a44c", lens: "clear" });
    expect(defaultConfig(getProduct("studio")!)).toEqual({ finish: "matte", frameColor: "#111827", lens: "clear" });
    expect(defaultConfig(getProduct("crystal")!)).toEqual({ finish: "glass", frameColor: "#7c3aed", lens: "iridescent" });
  });

  it("validates choice values and custom colors", () => {
    expect(isValidValue(option("finish"), "glass")).toBe(true);
    expect(isValidValue(option("finish"), "wood")).toBe(false);
    expect(isValidValue(option("frameColor"), "#12ab34")).toBe(true);
    expect(isValidValue(option("frameColor"), "red")).toBe(false);
  });

  it("validates and labels range values (bounds and step)", () => {
    const range = {
      kind: "range" as const,
      id: "opacity",
      label: "Opacity",
      min: 0.2,
      max: 1,
      step: 0.05,
      displayScale: 100,
      unit: "%",
      default: "0.8",
    };
    expect(isValidValue(range, "0.8")).toBe(true);
    expect(isValidValue(range, "0.2")).toBe(true);
    expect(isValidValue(range, "1")).toBe(true);
    expect(isValidValue(range, "0.83")).toBe(false);
    expect(isValidValue(range, "1.05")).toBe(false);
    expect(isValidValue(range, "abc")).toBe(false);
    expect(isValidValue(range, "")).toBe(false);
    expect(optionValueLabel(range, "0.85")).toBe("85%");
    expect(optionPriceDelta(range, "0.5")).toBe(0);
  });

  it("sanitizes configs: unknown options dropped, invalid values reset to defaults", () => {
    expect(sanitizeConfig(aviator, { finish: "wood", lens: "holographic", extra: "x" })).toEqual({
      finish: "metal",
      frameColor: "#c9a44c",
      lens: "holographic",
    });
  });
});
