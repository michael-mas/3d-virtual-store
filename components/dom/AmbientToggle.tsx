"use client";

import { useEffect } from "react";
import { useT } from "@/hooks/useT";
import { setAmbientMusic } from "@/lib/ambient";
import { useAppStore } from "@/store/useAppStore";

/** Ambient music on/off, next to the cart. Off by default; the bars move while it plays. */
export default function AmbientToggle() {
  const on = useAppStore((s) => s.musicOn);
  const setOn = useAppStore((s) => s.setMusicOn);
  const t = useT();

  useEffect(() => {
    void setAmbientMusic(on);
  }, [on]);

  // Silence while the tab is hidden.
  useEffect(() => {
    if (!on) return;
    const onVisibility = () => void setAmbientMusic(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [on]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={t(on ? "Ambient music on" : "Ambient music off")}
      title={t(on ? "Mute the music" : "Play ambient music")}
      onClick={() => setOn(!on)}
      className="chip flex h-[2.875rem] items-center gap-2 rounded-full px-[0.95rem] sm:px-4"
    >
      <span aria-hidden className="flex h-3.5 items-end gap-[3px]">
        {[0.55, 1, 0.7, 0.85].map((h, i) => (
          <span
            key={i}
            className={`w-[2px] origin-bottom rounded-full bg-gold-light ${on ? "animate-[ambient-bar_1.1s_ease-in-out_infinite]" : ""}`}
            style={{ height: `${on ? h * 100 : 25}%`, animationDelay: `${i * -0.27}s` }}
          />
        ))}
      </span>
      <span className="hidden sm:inline">{t(on ? "Music" : "Music off")}</span>
    </button>
  );
}
