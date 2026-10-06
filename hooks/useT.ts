"use client";

import { useCallback } from "react";
import { translate, type Translate } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

/** `t(englishText, vars?)` in the current locale; components re-render when the locale changes. */
export function useT(): Translate {
  const locale = useAppStore((s) => s.locale);
  return useCallback<Translate>((key, vars) => translate(locale, key, vars), [locale]);
}
