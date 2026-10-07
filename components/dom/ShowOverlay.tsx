"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useT } from "@/hooks/useT";
import { player } from "@/lib/explore/player";
import { actAt, APPLAUSE, CREDITS, cueAt, INTERACTIVE_ACT, type Act } from "@/lib/gallery/show";
import { clap, setCinema, showTime, stopShow } from "@/lib/gallery/stage";
import { takeSouvenir } from "./Passport";
import { useAppStore } from "@/store/useAppStore";

/**
 * The performance's frame, in the manner of a film: cinema bars that close in as the lights go down, the act's
 * number, title and line as surtitles, the accent flashes (never with reduced motion), the end credits, and the
 * controls: applause during the bow (three claps bring the automatons back), the director's camera or the visitor's
 * own, and leaving the performance (also Escape).
 */

/** The end credits, line by line (role, name); names are the work's, roles go through the catalog. */
const CREDIT_LINES: readonly [string, string][] = [
  ["", "Les Trois Automates"],
  ["Choreography", "Compagnie Atlas"],
  ["Light", "Atelier Prisma Aurum"],
  ["Music", "Synthesized live, in your browser"],
  ["Automatons", "Ivoire · Chrome · Onyx"],
  ["", "Thank you for coming."],
];
export default function ShowOverlay() {
  const playing = useAppStore((s) => s.showPlaying);
  const cinema = useAppStore((s) => s.showCinema);
  const t = useT();
  const reducedMotion = useReducedMotion();
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const [act, setAct] = useState<Act | null>(null);
  const [ending, setEnding] = useState({ applause: false, credits: 0 });

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
      const applause = time >= APPLAUSE.start && time <= APPLAUSE.end;
      const credits = time < CREDITS.start || time > CREDITS.end ? 0 : Math.min(CREDIT_LINES.length, 1 + Math.floor((time - CREDITS.start) / 1.1));
      setEnding((e) => (e.applause === applause && e.credits === credits ? e : { applause, credits }));
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
      {ending.credits > 0 && (
        <div data-testid="show-credits" className="absolute top-[14vh] right-6 left-6 flex flex-col items-center gap-2.5 text-center sm:right-10 sm:left-auto sm:w-80 sm:items-end sm:text-right">
          {CREDIT_LINES.slice(0, ending.credits).map(([role, name], i) => (
            <p key={i} className="animate-[credit-in_900ms_ease-out_both] [text-shadow:0_1px_10px_rgb(0_0_0/0.8)]">
              {role && <span className="eyebrow mb-0.5 block text-[0.55rem] text-gold">{t(role)}</span>}
              <span className={`font-display text-ivory italic ${i === 0 ? "text-xl" : "text-sm"}`}>{i === 0 ? name : t(name)}</span>
            </p>
          ))}
        </div>
      )}
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
          {ending.credits > 0 && (
            <button type="button" onClick={() => takeSouvenir("Les Trois Automates")} className="eyebrow text-[0.55rem] text-ivory/80 hover:text-ivory">
              {t("Souvenir")}
            </button>
          )}
          {ending.applause && (
            <button type="button" onClick={clap} className="btn-gold rounded-full px-4 py-2 text-[0.6rem]" data-testid="show-applaud">
              {t("Applaud")}
            </button>
          )}
          {!interactive && !ending.applause && (
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
