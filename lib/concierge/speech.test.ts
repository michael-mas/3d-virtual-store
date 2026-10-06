import { describe, expect, it } from "vitest";
import { CHAR_S, isSpeaking, mouthOpenAt, utteranceDuration } from "./speech";

describe("speech", () => {
  const u = { text: "Bonjour. Ok", start: 10 };

  it("opens the mouth on vowels, half on consonants, not at all on spaces, before or after", () => {
    // "B" (consonant) at slot 0, "o" (vowel) at slot 1: both at mid-slot.
    expect(mouthOpenAt(u, 10 + CHAR_S * 0.5)).toBeCloseTo(0.35, 2);
    expect(mouthOpenAt(u, 10 + CHAR_S * 1.5)).toBeCloseTo(0.95, 2);
    expect(mouthOpenAt(u, 9)).toBe(0);
    expect(mouthOpenAt(u, 10 + utteranceDuration(u.text) + 0.1)).toBe(0);
    expect(mouthOpenAt(null, 10)).toBe(0);
  });

  it("pauses on sentence ends and knows when it is speaking", () => {
    // "Bonjour." takes 7 letters + a 5-slot pause, then " Ok".
    expect(utteranceDuration(u.text)).toBeCloseTo((7 + 5 + 3) * CHAR_S, 6);
    expect(mouthOpenAt(u, 10 + CHAR_S * 9)).toBe(0);
    expect(isSpeaking(u, 10.05)).toBe(true);
    expect(isSpeaking(u, 10 + utteranceDuration(u.text) + 0.01)).toBe(false);
  });
});
