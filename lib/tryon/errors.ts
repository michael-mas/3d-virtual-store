import { DEMO_VIDEO_SOURCES } from "@/lib/assets";
import type { Translate } from "@/lib/i18n";

/** Everything that can stop a try-on session, each with a user-facing explanation and the ways out. */
export type TryOnErrorKind =
  | "denied"
  | "no-camera"
  | "in-use"
  | "insecure"
  | "unsupported"
  | "disconnected"
  | "stalled"
  | "model"
  | "demo"
  | "photo"
  | "unknown";

export type TryOnError = { kind: TryOnErrorKind; title: string; message: string; detail?: string };

const COPY: Record<TryOnErrorKind, { title: string; message: string }> = {
  denied: {
    title: "Camera access blocked",
    message: "Allow camera access in your browser's site settings, then try again.",
  },
  "no-camera": {
    title: "No camera found",
    message: "Connect a webcam and try again.",
  },
  "in-use": {
    title: "Camera is busy",
    message: "Another app or tab is using the camera. Close it and try again.",
  },
  insecure: {
    title: "Camera needs a secure connection",
    message: "Open this page over HTTPS (or localhost) to use the camera.",
  },
  unsupported: {
    title: "Camera not supported",
    message: "This browser can't access a camera. Try a recent version of Chrome, Edge, Firefox or Safari.",
  },
  disconnected: {
    title: "Camera disconnected",
    message: "The camera stopped. Reconnect it and try again.",
  },
  stalled: {
    title: "Camera stopped responding",
    message: "No video has arrived for a few seconds. Try again.",
  },
  model: {
    title: "Face tracking failed to load",
    message: "The face tracking model couldn't be loaded. Check your connection and try again.",
  },
  demo: {
    title: "Demo video unavailable",
    message: "The sample video couldn't be played. Try again or go back.",
  },
  photo: {
    title: "Photo couldn't be opened",
    message: "This file isn't an image the browser can read. Choose a JPEG, PNG or WebP photo.",
  },
  unknown: {
    title: "Something went wrong",
    message: "The try-on couldn't start. Try again or go back.",
  },
};

/** The error's user-facing copy, in the language of `t` (English by default; the panel passes its translator). */
export function tryOnError(kind: TryOnErrorKind, detail?: string, t: Translate = (key) => key): TryOnError {
  const copy = COPY[kind];
  let message = t(copy.message);
  if (detail && kind === "unknown") message += ` (${detail})`;
  if (canUseDemo(kind)) message += ` ${t("You can also use the demo video.")}`;
  return { kind, title: t(copy.title), message, detail };
}

/** Every title and message, for the translation catalog's completeness test. */
export const ERROR_COPY: readonly string[] = Object.values(COPY).flatMap((c) => [c.title, c.message]);

/** Maps a getUserMedia failure (or its absence) to an error kind. */
export function classifyCameraError(error: unknown): TryOnErrorKind {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "denied";
    case "SecurityError":
      return "insecure";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "no-camera";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "in-use";
    default:
      return "unknown";
  }
}

/** Camera-related failures can fall back to the demo video, when one is configured (lib/assets.ts). */
export const canUseDemo = (kind: TryOnErrorKind, available = DEMO_VIDEO_SOURCES.length > 0) =>
  available && kind !== "model" && kind !== "demo" && kind !== "photo";

/** Face tracking keeps the last pose this long after the face is lost, then hides the glasses. */
export const FACE_LOST_GRACE_MS = 1000;
/** No video frame for this long (while the page is visible) means the camera is frozen. */
export const STALL_TIMEOUT_MS = 3000;
