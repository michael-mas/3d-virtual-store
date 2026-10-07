"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/hooks/useT";
import { useAppStore } from "@/store/useAppStore";
import Brand from "./Brand";
import LanguageToggle from "./LanguageToggle";

/**
 * The house's threshold: loading progress of the scene assets (GLBs via three's DefaultLoadingManager, through
 * drei's useProgress) until the first frame is rendered, then a welcome with the salon dimly visible behind it.
 * "Enter the Maison" lifts the veil (fade), then the screen unmounts. A renderer error skips the welcome.
 */
export default function LoadingScreen() {
  const { progress, active, item } = useProgress();
  const ready = useAppStore((s) => s.sceneReady);
  const failed = useAppStore((s) => s.rendererError !== null);
  const [entered, setEntered] = useState(false);
  const [gone, setGone] = useState(false);
  const enter = useRef<HTMLButtonElement>(null);
  const t = useT();

  const leaving = entered || failed;
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    if (ready) enter.current?.focus();
  }, [ready]);

  if (gone) return null;
  // Before any asset request starts, progress is 0 and inactive: show an indeterminate start.
  const pct = ready ? 100 : Math.round(progress);
  const label = active ? t("Loading {file}…", { file: item.split("/").pop() ?? "" }) : t("Preparing the salon…");

  return (
    <div
      data-testid="loading-screen"
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center gap-8 px-6 text-ivory transition-[opacity,backdrop-filter,background-color] duration-[900ms] ease-out ${
        ready ? "bg-noir/70 backdrop-blur-md" : "bg-noir"
      } ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="eyebrow text-gold">{t("Est. MMXXVI · Virtual boutique")}</p>
        <p>
          <Brand size="text-3xl sm:text-5xl" small="text-xs sm:text-sm" />
        </p>
        <p
          className={`max-w-sm font-display text-base text-ivory/70 italic transition-opacity duration-700 sm:text-lg ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        >
          {t("Eyewear, beauty, horology and fine jewelry, to try on in the mirror of your camera.")}
        </p>
      </div>

      {ready ? (
        <button
          ref={enter}
          type="button"
          onClick={() => {
            setEntered(true);
            useAppStore.getState().setEntered();
          }}
          className="btn-line rounded-sm border-gold/60 px-8 py-3.5 text-gold-light"
        >
          {t("Enter the Maison")}
        </button>
      ) : (
        <div
          role="progressbar"
          aria-label={t("Loading the store")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="flex flex-col items-center gap-3"
        >
          <div className="h-px w-56 overflow-hidden bg-ivory/15">
            <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${Math.max(pct, 4)}%` }} />
          </div>
          <p className="eyebrow text-[0.6rem]">{label}</p>
        </div>
      )}
    </div>
  );
}
