"use client";

import { useEffect, useRef } from "react";
import { canUseDemo } from "@/lib/tryon/errors";
import { useAppStore } from "@/store/useAppStore";
import LookSwitcher from "./LookSwitcher";

const STATUS_TEXT = {
  idle: "Starting…",
  camera: "Starting camera…",
  model: "Loading face tracking…",
} as const;

/** TRY_ON overlay: progress, "face the camera" hint, error card with a way out, look switcher, capture/exit controls. */
export default function TryOnPanel() {
  const mode = useAppStore((s) => s.mode);
  const status = useAppStore((s) => s.tryOnStatus);
  const error = useAppStore((s) => s.tryOnError);
  const source = useAppStore((s) => s.tryOnSource);
  const faceDetected = useAppStore((s) => s.faceDetected);
  const progress = useAppStore((s) => s.tryOnProgress);
  const { transition, retryTryOn, setTryOnSource } = useAppStore.getState();
  const primaryAction = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (error) primaryAction.current?.focus();
  }, [error]);

  // PHOTO is handled by PhotoModal.
  if (mode !== "TRY_ON") return null;

  if (status === "error" && error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div
          role="alertdialog"
          aria-labelledby="tryon-error-title"
          aria-describedby="tryon-error-message"
          data-testid="tryon-error"
          data-kind={error.kind}
          className="w-full max-w-sm space-y-4 rounded-2xl bg-neutral-900 p-5 text-neutral-100 shadow-2xl ring-1 ring-white/10"
        >
          <h2 id="tryon-error-title" className="text-lg font-semibold">
            {error.title}
          </h2>
          <p id="tryon-error-message" className="text-sm text-neutral-300">
            {error.message}
          </p>
          <div className="flex flex-col gap-2">
            <button
              ref={primaryAction}
              type="button"
              onClick={retryTryOn}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
            >
              Try again
            </button>
            {canUseDemo(error.kind) && (
              <button
                type="button"
                onClick={() => setTryOnSource("demo")}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
              >
                Use demo video
              </button>
            )}
            <button
              type="button"
              onClick={() => transition("EXIT")}
              className="rounded-lg bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
            >
              Back to customize
            </button>
          </div>
        </div>
      </div>
    );
  }

  const loadingText =
    status === "model" && progress !== null && progress < 1
      ? `Downloading face tracking… ${Math.round(progress * 100)}%`
      : STATUS_TEXT[status === "error" || status === "running" ? "idle" : status];
  const message = status !== "running" ? loadingText : !faceDetected ? "Face the camera" : null;

  return (
    <>
      {source === "demo" && (
        <p className="fixed top-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-indigo-600/90 px-3 py-1 text-xs font-medium text-white">
          Demo video
        </p>
      )}
      {message && (
        <p
          role="status"
          data-testid="tryon-status"
          className="fixed top-1/2 left-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white"
        >
          {status !== "running" && (
            <span aria-hidden className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          {message}
        </p>
      )}
      <LookSwitcher />
      <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => transition("EXIT")}
          className="rounded-full bg-neutral-900/80 px-5 py-2.5 text-sm text-white ring-1 ring-white/15 hover:bg-neutral-800"
        >
          Exit
        </button>
        <button
          type="button"
          disabled={!faceDetected}
          onClick={() => transition("CAPTURE")}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 disabled:opacity-40"
        >
          Capture
        </button>
      </div>
    </>
  );
}
