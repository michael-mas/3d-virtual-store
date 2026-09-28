"use client";

import { useAppStore } from "@/store/useAppStore";

export default function TryOnPanel() {
  const mode = useAppStore((s) => s.mode);
  const status = useAppStore((s) => s.tryOnStatus);
  const error = useAppStore((s) => s.tryOnError);
  const faceDetected = useAppStore((s) => s.faceDetected);
  const transition = useAppStore((s) => s.transition);

  if (mode !== "TRY_ON" && mode !== "PHOTO") return null;

  const message =
    status === "error"
      ? error
      : status !== "running"
        ? "Starting camera…"
        : !faceDetected
          ? "Look at the camera"
          : null;

  return (
    <>
      {message && (
        <p
          role="status"
          className="fixed top-1/2 left-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-white"
        >
          {message}
        </p>
      )}
      <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => transition("EXIT")}
          className="rounded-full bg-neutral-900/80 px-5 py-2.5 text-sm text-white ring-1 ring-white/15 hover:bg-neutral-800"
        >
          Exit
        </button>
        {mode === "TRY_ON" ? (
          <button
            type="button"
            disabled={!faceDetected}
            onClick={() => transition("CAPTURE")}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 disabled:opacity-40"
          >
            Capture
          </button>
        ) : (
          <button
            type="button"
            onClick={() => transition("RETAKE")}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-900"
          >
            Retake
          </button>
        )}
      </div>
    </>
  );
}
