export const MODES = ["EXPLORE", "CUSTOMIZE", "TRY_ON", "PHOTO"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_EVENTS = ["INTERACT", "BACK", "TRY_ON", "CAPTURE", "RETAKE", "EXIT"] as const;
export type ModeEvent = (typeof MODE_EVENTS)[number];

/** The only allowed mode transitions. Anything not listed is invalid. */
export const TRANSITIONS: Readonly<Record<Mode, Partial<Record<ModeEvent, Mode>>>> = {
  EXPLORE: { INTERACT: "CUSTOMIZE" },
  CUSTOMIZE: { BACK: "EXPLORE", TRY_ON: "TRY_ON" },
  TRY_ON: { CAPTURE: "PHOTO", EXIT: "CUSTOMIZE" },
  PHOTO: { RETAKE: "TRY_ON", EXIT: "CUSTOMIZE" },
};

/** Returns the next mode, or null if `event` is not valid in `mode`. */
export function nextMode(mode: Mode, event: ModeEvent): Mode | null {
  return TRANSITIONS[mode][event] ?? null;
}
