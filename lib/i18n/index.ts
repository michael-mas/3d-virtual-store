import { FR } from "./fr";

/**
 * The site speaks English and French. Messages are keyed by their English text (gettext style): English needs no
 * catalog, and a missing French entry falls back to English instead of showing a key. `{name}` placeholders are
 * filled from `vars`. Product names (L'Aviateur, Chrono Nuit…) are the house's and are never translated.
 */
export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

const CATALOGS: Record<Locale, Readonly<Record<string, string>>> = { en: {}, fr: FR };

export function translate(locale: Locale, key: string, vars?: Readonly<Record<string, string | number>>): string {
  const text = CATALOGS[locale][key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
}

export type Translate = (key: string, vars?: Readonly<Record<string, string | number>>) => string;

/** The visitor's preferred language among ours: French for any fr-* browser language, English otherwise. */
export function preferredLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return "en";
}

export const LOCALE_STORAGE_KEY = "locale";
