import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, PRODUCTS, TRY_ON_ZONES } from "@/lib/products";
import { ERROR_COPY } from "@/lib/tryon/errors";
import { ALL_HINTS, STATUS_TEXT } from "@/lib/tryon/hints";
import { FR } from "./fr";
import { preferredLocale, translate } from "./index";

/** Source files of the interface. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** English keys passed literally to t(): t("…"), and both branches of t(cond ? "…" : "…"). */
function literalKeys(): string[] {
  const keys = new Set<string>();
  for (const file of ["components", "hooks", "app"].flatMap(sources)) {
    const code = readFileSync(file, "utf8");
    for (const m of code.matchAll(/\bt\(\s*(?:[\w.]+\s*\?\s*)?"([^"]+)"(?:\s*:\s*"([^"]+)")?/g)) {
      keys.add(m[1]);
      if (m[2]) keys.add(m[2]);
    }
  }
  return [...keys];
}

/** Everything the schema-generated UI shows: option labels and values, zones, categories, taglines. */
function schemaKeys(): string[] {
  const keys = new Set<string>();
  for (const p of PRODUCTS) {
    if (p.tagline) keys.add(p.tagline);
    for (const o of p.options) {
      keys.add(o.label);
      if (o.kind === "choice") o.values.forEach((v) => keys.add(v.label));
      if (o.kind === "color") o.presets.forEach((v) => keys.add(v.label));
    }
  }
  TRY_ON_ZONES.forEach((z) => keys.add(z.label));
  Object.values(CATEGORY_LABELS).forEach((c) => keys.add(c));
  return [...keys];
}

describe("i18n", () => {
  it("has a French translation for every interface string", () => {
    const keys = [...literalKeys(), ...schemaKeys(), ...ERROR_COPY, ...ALL_HINTS, ...Object.values(STATUS_TEXT)];
    expect(keys.length).toBeGreaterThan(150);
    expect(keys.filter((k) => !(k in FR))).toEqual([]);
  });

  it("keeps the placeholders of every message", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [en, fr] of Object.entries(FR)) expect(names(fr), en).toEqual(names(en));
  });

  it("translates, fills placeholders and falls back to English", () => {
    expect(translate("fr", "Try on {name}", { name: "Solitaire" })).toBe("Essayer Solitaire");
    expect(translate("en", "Try on {name}", { name: "Solitaire" })).toBe("Try on Solitaire");
    expect(translate("fr", "A sentence nobody translated")).toBe("A sentence nobody translated");
  });

  it("picks French for any French browser language, English otherwise", () => {
    expect(preferredLocale(["fr-CA", "en-US"])).toBe("fr");
    expect(preferredLocale(["de-DE", "fr"])).toBe("fr");
    expect(preferredLocale(["en-GB"])).toBe("en");
    expect(preferredLocale(["es"])).toBe("en");
  });
});
