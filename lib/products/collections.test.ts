import { describe, expect, it } from "vitest";
import { priceOf } from "@/lib/cart/pricing";
import { GOLD_AT, MIRROR_AT, unlockedCollections } from "@/lib/gallery/passport";
import { collectionOverrides, defaultConfig, isValidValue, lookConfig, PRODUCTS } from "./index";

describe("collections", () => {
  it("are offered on every piece, Gold and Mirror locked behind the passport, at a price", () => {
    for (const p of PRODUCTS) {
      const option = p.options.find((o) => o.id === "collection");
      expect(option?.kind, p.id).toBe("choice");
      if (option?.kind !== "choice") continue;
      expect(option.default).toBe("atelier");
      expect(option.values.filter((v) => v.unlock).map((v) => v.value)).toEqual(["or", "miroir"]);
      const base = defaultConfig(p);
      expect(priceOf(p.id, { ...base, collection: "or" })).toBeGreaterThan(priceOf(p.id, base));
      expect(priceOf(p.id, { ...base, collection: "miroir" })).toBeGreaterThan(priceOf(p.id, { ...base, collection: "or" }));
    }
  });

  it("give every piece its own reading of gold and of the mirror, with valid values only", () => {
    for (const p of PRODUCTS) {
      for (const c of ["or", "miroir"]) {
        const set = collectionOverrides(p, c);
        expect(Object.keys(set).length, `${p.id} ${c}`).toBeGreaterThan(0);
        for (const [id, value] of Object.entries(set)) expect(isValidValue(p.options.find((o) => o.id === id)!, value)).toBe(true);
      }
      const base = defaultConfig(p);
      expect(lookConfig(p, base)).toBe(base);
    }
  });

  it("unlock with the passport: Gold at six stamps, Mirror with all of them", () => {
    expect(unlockedCollections([])).toEqual({ or: false, miroir: false });
    expect(unlockedCollections(Array.from({ length: GOLD_AT }, (_, i) => `w${i}`))).toEqual({ or: true, miroir: false });
    expect(unlockedCollections(Array.from({ length: MIRROR_AT }, (_, i) => `w${i}`))).toEqual({ or: true, miroir: true });
  });
});
