import { describe, expect, it } from "vitest";
import { clearZone, defaultLook, itemsByZone, lookItems, wearItem, withoutItem, wornProductIds } from "./look";

const items = [
  { id: "a", productId: "aviator" },
  { id: "l", productId: "velvet-lip" },
  { id: "s", productId: "studio" },
  { id: "p", productId: "glow-paint" },
];

describe("look", () => {
  it("starts with the most recently added item of each zone", () => {
    expect(defaultLook(items)).toEqual({ eyewear: "s", lips: "l", skin: "p" });
  });

  it("swaps an item within its zone and can leave a zone bare", () => {
    const look = wearItem(defaultLook(items), items[0]);
    expect(look.eyewear).toBe("a");
    expect(clearZone(look, "lips")).toEqual({ eyewear: "a", skin: "p" });
  });

  it("drops removed items", () => {
    expect(withoutItem(defaultLook(items), "l")).toEqual({ eyewear: "s", skin: "p" });
  });

  it("lists worn items in drawing order: skin, lips, eyewear", () => {
    expect(lookItems(defaultLook(items), items).map((i) => i.id)).toEqual(["p", "l", "s"]);
  });

  it("groups the cart by zone, skipping empty zones", () => {
    const rows = itemsByZone(items.slice(0, 3));
    expect(rows.map((r) => [r.id, r.items.map((i) => i.id)])).toEqual([
      ["lips", ["l"]],
      ["eyewear", ["a", "s"]],
    ]);
  });

  it("wears the look's products, or the active product without a look", () => {
    expect(wornProductIds({ look: defaultLook(items), items, activeProductId: "aviator" })).toEqual([
      "glow-paint",
      "velvet-lip",
      "studio",
    ]);
    expect(wornProductIds({ look: null, items, activeProductId: "aviator" })).toEqual(["aviator"]);
  });
});
