"use client";

import { useEffect } from "react";
import { LOCALE_STORAGE_KEY, LOCALES, preferredLocale, type Locale } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

function savedLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return (LOCALES as readonly string[]).includes(saved ?? "") ? (saved as Locale) : null;
  } catch {
    return null;
  }
}

/**
 * Mounted once: on load applies the visitor's saved choice, else the browser's language, and keeps `<html lang>`
 * in sync (screen readers, hyphenation).
 */
export function LocaleSync() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  useEffect(() => {
    setLocale(savedLocale() ?? preferredLocale(navigator.languages ?? [navigator.language]));
  }, [setLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

/** Applies and remembers a language choice (the switch below, the concierge on request). */
export function chooseLocale(next: Locale) {
  useAppStore.getState().setLocale(next);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // Storage unavailable: the choice lasts until reload.
  }
}

/** EN | FR switch; remembers a manual choice. */
export default function LanguageToggle() {
  const locale = useAppStore((s) => s.locale);
  const choose = chooseLocale;

  return (
    <div role="group" aria-label="Language / Langue" className="chip flex h-[2.875rem] items-center rounded-full px-1.5">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          aria-label={l === "en" ? "English" : "Français"}
          onClick={() => choose(l)}
          className={`rounded-full px-2.5 py-1.5 transition-colors ${locale === l ? "bg-ivory/10 text-gold-light" : "text-ivory/50 hover:text-ivory"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
