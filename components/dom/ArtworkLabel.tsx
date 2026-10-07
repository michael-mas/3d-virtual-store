"use client";

import { useState } from "react";
import { useT } from "@/hooks/useT";
import { ARTWORKS, getArtwork, type Artwork } from "@/lib/gallery/artworks";
import { presentArtwork } from "@/lib/gallery/interactions";
import { startShow } from "@/lib/gallery/stage";
import { useAppStore } from "@/store/useAppStore";

/** The work's gesture: the performance starts; any other work answers and the camera turns to it. */
const act = (work: Artwork) => (work.kind === "performance" ? startShow() : presentArtwork(work.id));

/**
 * Phones: one slim bar at the bottom (title, artist and year, the gesture, and the work's story on demand, folded by
 * default), so the scene stays visible and the floor stays free to tap. Reset for each work (keyed by it).
 */
function CompactLabel({ work }: { work: Artwork }) {
  const t = useT();
  const [story, setStory] = useState(false);
  return (
    <aside
      aria-label={t("Museum label")}
      data-testid="artwork-label-compact"
      className="panel fixed inset-x-3 bottom-[4.25rem] z-30 rounded-sm px-3 py-2 sm:hidden"
    >
      <div className="flex items-center gap-2.5">
        <div role="status" className="min-w-0 flex-1">
          <p className="truncate font-display text-[0.95rem] leading-tight text-ivory italic">{work.title}</p>
          <p className="truncate text-[0.68rem] text-taupe">
            {work.artist}, {work.year}
          </p>
        </div>
        {work.gesture && (
          <button type="button" onClick={() => act(work)} className="btn-gold shrink-0 rounded-sm px-2.5 py-2 text-[0.55rem]">
            {t(work.gesture)}
          </button>
        )}
        <button
          type="button"
          aria-expanded={story}
          aria-label={t("Its story")}
          onClick={() => setStory(!story)}
          className="chip flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-sans text-[0.8rem] font-semibold normal-case"
        >
          i
        </button>
      </div>
      {work.kind === "performance" && <p className="mt-1 text-[0.62rem] text-taupe">⚠ {t("Contains flashing lights.")}</p>}
      {story && <p className="mt-2 max-h-[28dvh] overflow-y-auto font-display text-[0.85rem] leading-snug text-ivory/90 italic">{t(work.note)}</p>}
    </aside>
  );
}

/**
 * The gallery's museum label (cartel), in EXPLORE: before a work, its title, artist, year and medium (the
 * concierge tells its story) and what touching it does (the same as a click on the work, and the camera turns to
 * it; before the stage, it starts the performance); elsewhere in the gallery, the exhibition's title (not on phones,
 * where the label is a slim bar). Hidden during the performance. Announced to screen readers.
 */
export default function ArtworkLabel() {
  const explore = useAppStore((s) => s.mode === "EXPLORE" && s.sceneReady && s.entered);
  const near = useAppStore((s) => s.nearArtwork);
  const inGallery = useAppStore((s) => s.inGallery);
  const showPlaying = useAppStore((s) => s.showPlaying);
  const t = useT();
  if (!explore || showPlaying || (!near && !inGallery)) return null;
  const work = near ? getArtwork(near) : undefined;

  return (
    <>
      {work && <CompactLabel key={work.id} work={work} />}
      <aside
        aria-label={t("Museum label")}
        data-testid="artwork-label"
        className="panel pointer-events-none fixed top-24 right-6 z-20 hidden w-[17rem] rounded-sm px-4 py-3 sm:block"
      >
        <p className="eyebrow mb-1.5 text-[0.55rem] text-gold">{t("The Gallery")}</p>
        {work ? (
          <div role="status">
            <h2 className="font-display text-xl leading-tight text-ivory italic">{work.title}</h2>
            <p className="mt-1 text-[0.8rem] tracking-wide text-ivory/85">
              {work.artist}, {work.year}
            </p>
            <p className="mt-0.5 text-[0.75rem] text-taupe">{t(work.medium)}</p>
            {work.gesture && (
              <button
                type="button"
                onClick={() => act(work)}
                className={`pointer-events-auto mt-3 rounded-sm px-3 py-1.5 text-[0.6rem] ${work.kind === "performance" ? "btn-gold" : "eyebrow text-gold-light ring-1 ring-gold/40 hover:ring-gold/80"}`}
              >
                {t(work.gesture)}
              </button>
            )}
            {work.kind === "performance" && <p className="mt-1.5 text-[0.65rem] text-taupe">⚠ {t("Contains flashing lights.")}</p>}
          </div>
        ) : (
          <div role="status">
            <h2 className="font-display text-xl leading-tight text-ivory italic">Matière &amp; Lumière</h2>
            <p className="mt-1 text-[0.75rem] text-taupe">{t("Contemporary art · {count} works", { count: String(ARTWORKS.length) })}</p>
          </div>
        )}
      </aside>
    </>
  );
}
