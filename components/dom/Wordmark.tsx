"use client";

import { useT } from "@/hooks/useT";
import Brand from "./Brand";

/** The page heading: the house's wordmark and its line, over the 3D view. */
export default function Wordmark() {
  const t = useT();
  return (
    <h1 className="flex flex-col items-center gap-1 text-ivory [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
      <Brand />
      <span className="eyebrow hidden text-[0.6rem] sm:block">{t("Virtual boutique & try-on")}</span>
    </h1>
  );
}
