import type { Locale } from "@/lib/i18n";
import type { Slice } from "./types";

export type LocaleSlice = {
  /** Interface language. English in the static HTML; LocaleSync applies the visitor's saved or browser choice. */
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const createLocaleSlice: Slice<LocaleSlice> = (set) => ({
  locale: "en",
  setLocale: (locale) => set({ locale }),
});
