import { describe, expect, it } from "vitest";
import { MODE_EVENTS, MODES, nextMode, type Mode, type ModeEvent } from "./modes";

// Spec, written independently of the TRANSITIONS table.
const VALID: Array<[Mode, ModeEvent, Mode]> = [
  ["EXPLORE", "INTERACT", "CUSTOMIZE"],
  ["CUSTOMIZE", "BACK", "EXPLORE"],
  ["CUSTOMIZE", "TRY_ON", "TRY_ON"],
  ["TRY_ON", "CAPTURE", "PHOTO"],
  ["PHOTO", "RETAKE", "TRY_ON"],
  ["TRY_ON", "EXIT", "CUSTOMIZE"],
  ["PHOTO", "EXIT", "CUSTOMIZE"],
];

describe("nextMode", () => {
  it.each(VALID)("%s -%s-> %s", (from, event, to) => {
    expect(nextMode(from, event)).toBe(to);
  });

  const invalid = MODES.flatMap((from) =>
    MODE_EVENTS.filter((event) => !VALID.some(([f, e]) => f === from && e === event)).map(
      (event) => [from, event] as const,
    ),
  );

  it("covers every mode × event pair", () => {
    expect(VALID.length + invalid.length).toBe(MODES.length * MODE_EVENTS.length);
  });

  it.each(invalid)("%s -%s-> is invalid", (from, event) => {
    expect(nextMode(from, event)).toBeNull();
  });
});
