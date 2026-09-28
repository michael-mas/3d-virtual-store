"use client";

import { useEffect, useRef, useState } from "react";
import { capturePhoto } from "@/lib/tryon/capture";
import { useAppStore } from "@/store/useAppStore";

/** PHOTO mode: captures once on entry, then shows the result with Download (PNG) and Return. */
export default function PhotoModal() {
  const mode = useAppStore((s) => s.mode);
  const photoUrl = useAppStore((s) => s.photoUrl);
  const transition = useAppStore((s) => s.transition);
  const [error, setError] = useState<string | null>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const close = () => {
    setError(null);
    transition("RETAKE");
  };

  useEffect(() => {
    if (mode !== "PHOTO") return;
    let cancelled = false;
    // Render + composite run synchronously inside capturePhoto(); only PNG encoding is awaited.
    capturePhoto()
      .then((blob) => {
        if (!cancelled && useAppStore.getState().mode === "PHOTO") {
          useAppStore.getState().setPhotoUrl(URL.createObjectURL(blob));
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "PHOTO") return;
    returnButton.current?.focus();
  }, [mode]);

  if (mode !== "PHOTO") return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your try-on photo"
      onKeyDown={(e) => e.key === "Escape" && close()}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl space-y-4 rounded-2xl bg-neutral-900 p-4 text-neutral-100 shadow-2xl ring-1 ring-white/10">
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL preview
            <img src={photoUrl} alt="Try-on capture" data-testid="photo" className="max-h-full max-w-full object-contain" />
          ) : (
            <p className="text-sm text-neutral-400">{error ?? "Capturing…"}</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            ref={returnButton}
            type="button"
            onClick={close}
            className="rounded-lg bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
          >
            Return
          </button>
          <a
            href={photoUrl ?? undefined}
            download="try-on.png"
            aria-disabled={!photoUrl}
            className={`rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 ${
              photoUrl ? "hover:bg-neutral-200" : "pointer-events-none opacity-40"
            }`}
          >
            Download PNG
          </a>
        </div>
      </div>
    </div>
  );
}
