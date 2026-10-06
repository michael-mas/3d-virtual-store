/** Status line while a try-on session starts (English keys, translated by the panel). */
export const STATUS_TEXT = {
  idle: "Starting…",
  camera: "Starting camera…",
  model: "Loading face tracking…",
} as const;

/** What the worn products still need in view, worded for the live camera or for a photo; null when nothing. */
export function tryOnHint(missingFace: boolean, missingHand: boolean, photo: boolean): string | null {
  if (missingFace && missingHand) return photo ? "No face or hand found in this photo" : "Face the camera and show your hand";
  if (missingFace) return photo ? "No face found in this photo" : "Face the camera";
  if (missingHand) return photo ? "No hand found in this photo" : "Show the back of your hand";
  return null;
}

/** Every hint, for the translation catalog's completeness test. */
export const ALL_HINTS: readonly string[] = [true, false].flatMap((photo) =>
  [
    [true, true],
    [true, false],
    [false, true],
  ].map(([face, hand]) => tryOnHint(face, hand, photo) as string),
);
