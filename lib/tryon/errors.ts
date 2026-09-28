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
  | "unknown";

export type TryOnError = { kind: TryOnErrorKind; title: string; message: string };

const COPY: Record<TryOnErrorKind, { title: string; message: string }> = {
  denied: {
    title: "Camera access blocked",
    message: "Allow camera access in your browser's site settings, then try again — or use the demo video.",
  },
  "no-camera": {
    title: "No camera found",
    message: "Connect a webcam and try again, or use the demo video instead.",
  },
  "in-use": {
    title: "Camera is busy",
    message: "Another app or tab is using the camera. Close it and try again, or use the demo video.",
  },
  insecure: {
    title: "Camera needs a secure connection",
    message: "Open this page over HTTPS (or localhost) to use the camera, or use the demo video.",
  },
  unsupported: {
    title: "Camera not supported",
    message: "This browser can't access a camera. Use the demo video instead.",
  },
  disconnected: {
    title: "Camera disconnected",
    message: "The camera stopped. Reconnect it and try again, or use the demo video.",
  },
  stalled: {
    title: "Camera stopped responding",
    message: "No video has arrived for a few seconds. Try again, or use the demo video.",
  },
  model: {
    title: "Face tracking failed to load",
    message: "The face tracking model couldn't be loaded. Check your connection and try again.",
  },
  demo: {
    title: "Demo video unavailable",
    message: "The sample video couldn't be played. Try again or go back.",
  },
  unknown: {
    title: "Something went wrong",
    message: "The try-on couldn't start. Try again or go back.",
  },
};

export function tryOnError(kind: TryOnErrorKind, detail?: string): TryOnError {
  const copy = COPY[kind];
  return { kind, title: copy.title, message: detail && kind === "unknown" ? `${copy.message} (${detail})` : copy.message };
}

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

/** Camera-related failures can fall back to the bundled demo video. */
export const canUseDemo = (kind: TryOnErrorKind) => kind !== "model" && kind !== "demo";

/** Face tracking keeps the last pose this long after the face is lost, then hides the glasses. */
export const FACE_LOST_GRACE_MS = 1000;
/** No video frame for this long (while the page is visible) means the camera is frozen. */
export const STALL_TIMEOUT_MS = 3000;
