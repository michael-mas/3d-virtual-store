"use client";

import { useT } from "@/hooks/useT";
import { ARTWORKS, getArtwork } from "@/lib/gallery/artworks";
import { useAppStore } from "@/store/useAppStore";

/**
 * The gallery's museum label (cartel), in EXPLORE: before a work, its title, artist, year and medium (the
 * concierge tells its story); elsewhere in the gallery, the exhibition's title. Announced to screen readers.
 */
export default function ArtworkLabel() {
  const explore = useAppStore((s) => s.mode === "EXPLORE" && s.sceneReady && s.entered);
  const near = useAppStore((s) => s.nearArtwork);
  const inGallery = useAppStore((s) => s.inGallery);
  const t = useT();
  if (!explore || (!near && !inGallery)) return null;
  const work = near ? getArtwork(near) : undefined;

  return (
    <aside
      aria-label={t("Museum label")}
      data-testid="artwork-label"
      className="panel pointer-events-none fixed top-20 right-4 z-20 w-[min(17rem,calc(100vw-2rem))] rounded-sm px-4 py-3 sm:top-24 sm:right-6"
    >
      <p className="eyebrow mb-1.5 text-[0.55rem] text-gold">{t("The Gallery")}</p>
      {work ? (
        <div role="status">
          <h2 className="font-display text-xl leading-tight text-ivory italic">{work.title}</h2>
          <p className="mt-1 text-[0.8rem] tracking-wide text-ivory/85">
            {work.artist}, {work.year}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-taupe">{t(work.medium)}</p>
        </div>
      ) : (
        <div role="status">
          <h2 className="font-display text-xl leading-tight text-ivory italic">Matière &amp; Lumière</h2>
          <p className="mt-1 text-[0.75rem] text-taupe">{t("Contemporary art · {count} works", { count: String(ARTWORKS.length) })}</p>
        </div>
      )}
    </aside>
  );
}
