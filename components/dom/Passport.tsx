"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/hooks/useT";
import { ARTWORKS, getArtwork } from "@/lib/gallery/artworks";
import { GOLD_AT, loadStamps, MIRROR_AT, saveStamps, unlockedCollections } from "@/lib/gallery/passport";
import { useAppStore } from "@/store/useAppStore";

type Notice = { id: number; kind: "stamp" | "or" | "miroir"; title: string };

/**
 * The gallery passport. In the gallery: a chip with a dot per work (filled when stamped), which opens the passport
 * (the works stamped, and the two collections it unlocks). Everywhere: a short notice for each new stamp, and a
 * larger one when a collection unlocks. Loads and keeps the stamps (this browser only).
 */
export default function Passport() {
  const t = useT();
  const stamps = useAppStore((s) => s.stamps);
  const setStamps = useAppStore((s) => s.setStamps);
  const visible = useAppStore((s) => s.mode === "EXPLORE" && s.inGallery && s.entered && !s.showPlaying);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const loaded = useRef(false);
  const seen = useRef<string[]>([]);

  useEffect(() => {
    const saved = loadStamps();
    seen.current = saved;
    loaded.current = true;
    if (saved.length) setStamps(saved);
  }, [setStamps]);

  // A new stamp: keep it, and say so (more loudly when it unlocks a collection).
  useEffect(() => {
    if (!loaded.current) return;
    const added = stamps.filter((id) => !seen.current.includes(id));
    const before = unlockedCollections(seen.current);
    seen.current = stamps;
    saveStamps(stamps);
    if (!added.length) return;
    const after = unlockedCollections(stamps);
    const kind = after.miroir && !before.miroir ? "miroir" : after.or && !before.or ? "or" : "stamp";
    const id = Date.now();
    // Deferred: not a synchronous state update inside the effect.
    const show = requestAnimationFrame(() => setNotice({ id, kind, title: getArtwork(added[added.length - 1])?.title ?? "" }));
    const hide = setTimeout(() => setNotice((n) => (n?.id === id ? null : n)), kind === "stamp" ? 3200 : 7000);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(hide);
    };
  }, [stamps]);

  const count = stamps.length;
  const unlocked = unlockedCollections(stamps);

  return (
    <>
      {visible && (
        <div className="fixed top-[4.75rem] left-3 z-30 sm:top-20 sm:left-6">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            data-testid="passport"
            className="chip flex items-center gap-2.5 rounded-full px-3.5 py-2"
          >
            <span className="eyebrow text-[0.55rem] text-gold">{t("Passport")}</span>
            <span aria-hidden className="flex gap-[3px]">
              {ARTWORKS.map((a) => (
                <span key={a.id} className={`h-1.5 w-1.5 rounded-full ${stamps.includes(a.id) ? "bg-gold-light" : "bg-ivory/20"}`} />
              ))}
            </span>
            <span className="text-[0.7rem] text-ivory/80">
              {count}/{MIRROR_AT}
            </span>
          </button>
          {open && (
            <div className="panel mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-sm px-4 py-3">
              <p className="font-display text-[0.9rem] leading-snug text-ivory italic">
                {t("Touch the works: each one stamps your passport.")}
              </p>
              <ul className="mt-2.5 space-y-1.5 text-[0.75rem]">
                <li className={unlocked.or ? "text-gold-light" : "text-ivory/70"}>
                  {unlocked.or ? "✓ " : `${Math.min(count, GOLD_AT)}/${GOLD_AT} · `}
                  {t("Gold collection, on every piece")}
                </li>
                <li className={unlocked.miroir ? "text-gold-light" : "text-ivory/70"}>
                  {unlocked.miroir ? "✓ " : `${count}/${MIRROR_AT} · `}
                  {t("Mirror collection, on every piece")}
                </li>
              </ul>
              {count > 0 && (
                <p className="mt-2.5 text-[0.7rem] leading-relaxed text-taupe">{stamps.map((id) => getArtwork(id)?.title).join(" · ")}</p>
              )}
            </div>
          )}
        </div>
      )}
      {notice && (
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[5.5rem] z-[60] flex justify-center px-4 sm:top-24">
          {notice.kind === "stamp" ? (
            <p className="panel rounded-full px-4 py-2 text-[0.75rem] text-ivory">
              <span className="eyebrow mr-2 text-[0.55rem] text-gold">{t("Stamped")}</span>
              {notice.title} · {count}/{MIRROR_AT}
            </p>
          ) : (
            <div className="panel max-w-sm rounded-sm px-6 py-4 text-center" data-testid="collection-unlocked">
              <p className="eyebrow text-[0.6rem] text-gold">{t("Unlocked")}</p>
              <p className="mt-1 font-display text-2xl text-ivory italic">
                {t(notice.kind === "or" ? "The Gold collection" : "The Mirror collection")}
              </p>
              <p className="mt-1.5 text-[0.8rem] text-ivory/75">{t("Now on every piece of the boutique: choose it when you customize one.")}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
