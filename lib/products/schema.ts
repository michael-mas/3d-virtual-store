import type { OptionSchema, Product, ProductConfig } from "./types";

const HEX = /^#[0-9a-f]{6}$/i;

const DECIMAL = /^-?\d+(\.\d+)?$/;

export function isValidValue(option: OptionSchema, value: string): boolean {
  if (option.kind === "choice") return option.values.some((v) => v.value === value);
  if (option.kind === "range") {
    if (!DECIMAL.test(value)) return false;
    const n = Number(value);
    const steps = (n - option.min) / option.step;
    return n >= option.min && n <= option.max && Math.abs(steps - Math.round(steps)) < 1e-6;
  }
  return option.presets.some((v) => v.value === value) || (option.allowCustom && HEX.test(value));
}

/** Schema defaults, optionally overridden (invalid overrides are ignored). */
export function defaultConfig(product: Product, overrides: Record<string, string> = {}): ProductConfig {
  return Object.fromEntries(
    product.options.map((o) => {
      const v = overrides[o.id];
      return [o.id, v !== undefined && isValidValue(o, v) ? v : o.default];
    }),
  );
}

/** Drops unknown options and replaces invalid values with defaults. */
export function sanitizeConfig(product: Product, config: Record<string, string>): ProductConfig {
  return defaultConfig(product, config);
}

export function optionValueLabel(option: OptionSchema, value: string): string {
  if (option.kind === "range") {
    const shown = Number(value) * (option.displayScale ?? 1);
    return `${Number.isInteger(shown) ? shown : +shown.toFixed(2)}${option.unit ?? ""}`;
  }
  const list = option.kind === "choice" ? option.values : option.presets;
  return list.find((v) => v.value === value)?.label ?? value;
}

export function optionPriceDelta(option: OptionSchema, value: string): number {
  if (option.kind !== "choice") return 0;
  return option.values.find((v) => v.value === value)?.priceDelta ?? 0;
}
