"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useT } from "@/hooks/useT";
import { player } from "@/lib/explore/player";
import { actAt, cueAt, INTERACTIVE_ACT, type Act } from "@/lib/gallery/show";
import { setCinema, showTime, stopShow } from "@/lib/gallery/stage";
import { useAppStore } from "@/store/useAppStore";

/**
 * The performance's frame, in the manner of a film: cinema bars that close in as the lights go down, the act's
 * number, title and line as surtitles, the accent flashes (never with reduced motion), and two controls: the
 * director's camera or the visitor's own, and leaving the performance (also Escape).
 */
export default function ShowOverlay() {
  const playing = useAppStore((s) => s.showPlaying);
  const cinema = useAppStore((s) => s.showCinema);
  const t = useT();
  const reducedMotion = useReducedMotion();
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const [act, setAct] = useState<Act | null>(null);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let current: Act | null = null;
    const loop = () => {
      const time = Math.max(0, showTime());
      const cue = cueAt(time, player.position);
      const bar = `${(cue.letterbox * 11).toFixed(2)}vh`;
      if (top.current) top.current.style.height = bar;
      if (bottom.current) bottom.current.style.height = bar;
      if (flash.current) flash.current.style.opacity = reducedMotion ? "0" : String(cue.flash);
      const a = actAt(time);
      if (a !== current) {
        current = a;
        setAct(a);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopShow();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [playing, reducedMotion]);

  if (!playing) return null;
  const interactive = act?.id === INTERACTIVE_ACT;

  return (
    <div className="pointer-events-none fixed inset-0 z-[55]" data-testid="show-overlay">
      <div ref={flash} className="absolute inset-0 bg-[#fff4e0] opacity-0 mix-blend-screen" />
      <div ref={top} className="absolute inset-x-0 top-0 h-0 bg-black" />
      <div ref={bottom} className="absolute inset-x-0 bottom-0 flex h-0 items-center justify-between gap-4 overflow-hidden bg-black px-4 sm:px-8">
        <div role="status" aria-live="polite" className="min-w-0">
          {act && (
            <>
              <p className="eyebrow text-[0.55rem] text-gold">
                Les Trois Automates{act.numeral ? ` · ${t("Act")} ${act.numeral}` : ""}
              </p>
              <p className="truncate font-display text-base text-ivory italic sm:text-lg">
                {act.title} — <span className="text-ivory/75">{t(act.line)}</span>
              </p>
            </>
          )}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-3">
          {!interactive && (
            <button type="button" onClick={() => setCinema(!cinema)} aria-pressed={cinema} className="eyebrow text-[0.55rem] text-ivory/70 hover:text-ivory">
              {t(cinema ? "Free camera" : "Director's camera")}
            </button>
          )}
          <button type="button" onClick={stopShow} className="eyebrow text-[0.55rem] text-gold-light hover:text-ivory" data-testid="show-leave">
            {t("Leave the performance")}
          </button>
        </div>
      </div>
    </div>
  );
}
