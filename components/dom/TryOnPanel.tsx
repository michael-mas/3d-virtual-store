"use client";

import { useEffect, useRef } from "react";
import { wornTrackers } from "@/lib/cart/look";
import { useT } from "@/hooks/useT";
import { canUseDemo, tryOnError } from "@/lib/tryon/errors";
import { STATUS_TEXT, tryOnHint } from "@/lib/tryon/hints";
import { useAppStore } from "@/store/useAppStore";
import LookSwitcher from "./LookSwitcher";
import PhotoPicker from "./PhotoPicker";

const PILL = "chip rounded-full px-5 py-2.5";

/**
 * TRY_ON overlay: progress, "face the camera" hint, error card with a way out, look switcher, capture/exit controls,
 * and the switch between the camera and a photo from the device.
 */
export default function TryOnPanel() {
  const mode = useAppStore((s) => s.mode);
  const status = useAppStore((s) => s.tryOnStatus);
  const error = useAppStore((s) => s.tryOnError);
  const source = useAppStore((s) => s.tryOnSource);
  const faceDetected = useAppStore((s) => s.faceDetected);
  const handDetected = useAppStore((s) => s.handDetected);
  const hairDetected = useAppStore((s) => s.hairDetected);
  const needs = useAppStore((s) => [...wornTrackers(s)].sort().join("+"));
  const progress = useAppStore((s) => s.tryOnProgress);
  const { transition, retryTryOn, setTryOnSource } = useAppStore.getState();
  const primaryAction = useRef<HTMLButtonElement>(null);
  const t = useT();

  useEffect(() => {
    if (error) primaryAction.current?.focus();
  }, [error]);

  // PHOTO is handled by PhotoModal.
  if (mode !== "TRY_ON") return null;

  if (status === "error" && error) {
    const copy = tryOnError(error.kind, error.detail, t);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
        <div
          role="alertdialog"
          aria-labelledby="tryon-error-title"
          aria-describedby="tryon-error-message"
          data-testid="tryon-error"
          data-kind={error.kind}
          className="panel w-full max-w-sm space-y-4 rounded-sm p-6"
        >
          <h2 id="tryon-error-title" className="font-display text-2xl">
            {copy.title}
          </h2>
          <p id="tryon-error-message" className="text-sm text-taupe">
            {copy.message}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {error.kind === "photo" ? (
              <PhotoPicker
                buttonRef={primaryAction}
                className="btn-gold rounded-sm px-4 py-3"
              >
                {t("Choose another photo")}
              </PhotoPicker>
            ) : (
              <button
                ref={primaryAction}
                type="button"
                onClick={retryTryOn}
                className="btn-gold rounded-sm px-4 py-3"
              >
                {t("Try again")}
              </button>
            )}
            {canUseDemo(error.kind) && (
              <button
                type="button"
                onClick={() => setTryOnSource("demo")}
                className="btn-line rounded-sm border-gold/60 px-4 py-3 text-gold-light"
              >
                {t("Use demo video")}
              </button>
            )}
            {/* No webcam, or no permission: the same try-on on a photo. */}
            {source === "camera" && error.kind !== "model" && (
              <PhotoPicker className="btn-line rounded-sm border-gold/60 px-4 py-3 text-gold-light">
                {t("Use a photo instead")}
              </PhotoPicker>
            )}
            {source !== "camera" && (
              <button
                type="button"
                onClick={() => setTryOnSource("camera")}
                className="btn-line rounded-sm px-4 py-3"
              >
                {t("Use the camera")}
              </button>
            )}
            <button
              type="button"
              onClick={() => transition("EXIT")}
              className="btn-line rounded-sm px-4 py-3"
            >
              {t("Back to customize")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const loadingText =
    status === "model" && progress !== null && progress < 1
      ? t("Downloading face tracking… {percent}%", { percent: Math.round(progress * 100) })
      : status === "camera" && source === "photo"
        ? t("Opening photo…")
        : t(STATUS_TEXT[status === "error" || status === "running" ? "idle" : status]);
  // What the worn products need in view; the photo is possible as soon as one of them is tracked.
  // Hair color needs the head in view too: it asks for the face like face products.
  const missingFace = (needs.includes("face") && !faceDetected) || (needs.includes("hair") && !hairDetected);
  const missingHand = needs.includes("hand") && !handDetected;
  const tracked =
    (needs.includes("face") && faceDetected) ||
    (needs.includes("hand") && handDetected) ||
    (needs.includes("hair") && hairDetected);
  const photo = source === "photo";
  const hint = tryOnHint(missingFace, missingHand, photo);
  const message = status !== "running" ? loadingText : hint && t(hint);

  return (
    <>
      {source === "demo" && (
        <p className="chip fixed top-20 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-1.5 text-[0.6rem] text-gold-light">
          {t("Demo video")}
        </p>
      )}
      {photo && (
        <p className="chip fixed top-20 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-1.5 text-[0.6rem] text-gold-light">
          {t("Your photo · stays on this device")}
        </p>
      )}
      {message && (
        <p
          role="status"
          data-testid="tryon-status"
          className="chip fixed top-1/2 left-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full px-5 py-2.5"
        >
          {status !== "running" && (
            <span aria-hidden className="size-3 animate-spin rounded-full border border-gold/30 border-t-gold-light" />
          )}
          {message}
        </p>
      )}
      <LookSwitcher />
      <div className="fixed inset-x-0 bottom-6 z-40 flex flex-wrap justify-center gap-3 px-4">
        <button type="button" onClick={() => transition("EXIT")} className={PILL}>
          {t("Exit")}
        </button>
        <PhotoPicker className={PILL}>{t(photo ? "Change photo" : "Use a photo")}</PhotoPicker>
        {photo && (
          <button type="button" onClick={() => setTryOnSource("camera")} className={PILL}>
            {t("Camera")}
          </button>
        )}
        <button
          type="button"
          disabled={!tracked}
          onClick={() => transition("CAPTURE")}
          className="btn-gold rounded-full px-6 py-2.5"
        >
          {t("Capture")}
        </button>
      </div>
    </>
  );
}
