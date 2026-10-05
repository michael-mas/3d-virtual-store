"use client";

import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { capturePhoto } from "@/lib/tryon/capture";
import { isTryOnMirrored } from "@/lib/tryon/constants";
import { useAppStore } from "@/store/useAppStore";

/** PHOTO mode: captures once on entry, then shows the result with Download (PNG) and Return. */
export default function PhotoModal() {
  const mode = useAppStore((s) => s.mode);
  const photoUrl = useAppStore((s) => s.photoUrl);
  const transition = useAppStore((s) => s.transition);
  const [error, setError] = useState<string | null>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const close = () => {
    setError(null);
    transition("RETAKE");
  };

  useEffect(() => {
    if (mode !== "PHOTO") return;
    let cancelled = false;
    // Render + composite run synchronously inside capturePhoto(); only PNG encoding is awaited.
    capturePhoto(isTryOnMirrored(useAppStore.getState().tryOnSource))
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

  useDialogFocus(dialog, mode === "PHOTO", close, returnButton);

  if (mode !== "PHOTO") return null;

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Your try-on photo"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="panel flex max-h-full w-full max-w-2xl flex-col gap-4 rounded-sm p-5">
        <p className="wordmark text-center text-sm">Maison Miroir</p>
        {/* Preview keeps the photo's own aspect (portrait on phones, landscape on desktop). */}
        <div className="flex min-h-48 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-sm bg-black ring-1 ring-gold/20">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL preview
            <img
              src={photoUrl}
              alt="Your try-on photo"
              data-testid="photo"
              className="max-h-[70dvh] max-w-full object-contain"
            />
          ) : (
            <p role="status" className="eyebrow">
              {error ?? "Capturing…"}
            </p>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <button
            ref={returnButton}
            type="button"
            onClick={close}
            className="btn-line rounded-sm px-5 py-2.5"
          >
            Return
          </button>
          <a
            href={photoUrl ?? undefined}
            download="maison-miroir-try-on.png"
            aria-disabled={!photoUrl}
            className={`btn-gold rounded-sm px-5 py-2.5 ${photoUrl ? "" : "pointer-events-none opacity-40"}`}
          >
            Download PNG
          </a>
        </div>
      </div>
    </div>
  );
}
