"use client";

import AmbientToggle from "./AmbientToggle";
import CartButton from "./CartButton";
import LanguageToggle, { LocaleSync } from "./LanguageToggle";

/** Top-right controls: language, music, cart (a column on phones, where the wordmark takes the middle). */
export default function TopBar() {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col-reverse items-end gap-2 sm:flex-row sm:items-center">
      <LocaleSync />
      <LanguageToggle />
      <AmbientToggle />
      <CartButton />
    </div>
  );
}
