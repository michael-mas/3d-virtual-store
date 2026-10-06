"use client";

import { useEffect, useState } from "react";
import { useT } from "@/hooks/useT";
import { PEDESTALS } from "@/lib/explore/layout";
import { approachPoint } from "@/lib/explore/movement";
import { player, walkTo } from "@/lib/explore/player";
import { getProduct } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

/** Seconds the welcome stays before giving way (it also gives way to the first piece's tip). */
const WELCOME_S = 12;

/**
 * What the concierge says (EXPLORE): a welcome, then the tip of the piece in front of the visitor, with a guided
 * tour ("Next piece" walks to the following pedestal, in registry order). A steady card in a corner rather than a
 * bubble over the hovering robot, so it stays readable and its button easy to hit. Announced to screen readers.
 */
export default function ConciergePanel() {
  const mode = useAppStore((s) => s.mode);
  const ready = useAppStore((s) => s.sceneReady && s.entered);
  const near = useAppStore((s) => (s.mode === "EXPLORE" ? s.nearPedestal : null));
  const t = useT();
  const [welcome, setWelcome] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setWelcome(false), WELCOME_S * 1000);
    return () => clearTimeout(timer);
  }, [ready]);

  if (mode !== "EXPLORE" || !ready) return null;
  const greeting = welcome && !near;
  const product = near ? getProduct(near) : undefined;
  if (!greeting && !product?.tip) return null;

  const index = near ? PEDESTALS.findIndex((p) => p.productId === near) : -1;
  const next = PEDESTALS[(index + 1) % PEDESTALS.length];
  const nextName = getProduct(next.productId)?.name ?? "";

  return (
    <aside
      aria-label={t("Your concierge")}
      data-testid="concierge"
      className="panel fixed bottom-16 left-4 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-sm px-4 py-3 sm:bottom-20 sm:left-6"
    >
      <p className="eyebrow mb-1 text-[0.55rem] text-gold">{t("Your concierge")}</p>
      <p role="status" className="font-display text-[0.95rem] leading-snug text-ivory italic">
        {greeting ? t("Welcome to Maison Miroir. Walk up to any piece and I will present it.") : t(product!.tip!)}
      </p>
      <button
        type="button"
        onClick={() => walkTo(approachPoint(greeting ? PEDESTALS[0] : next, player.position, 0.9))}
        className="eyebrow mt-2 text-[0.6rem] text-gold-light underline-offset-4 hover:underline"
      >
        {greeting ? t("Begin the tour") : t("Next piece: {name}", { name: nextName })} →
      </button>
    </aside>
  );
}
