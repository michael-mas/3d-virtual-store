/**
 * What the concierge is saying, and how wide its mouth is at a given moment: a viseme-like envelope from the text
 * (open on vowels, half open on consonants, closed on spaces and punctuation), at a speaking pace. The face reads
 * mouthOpen() every frame; the chat calls say() for each reply.
 */

/** Seconds per character of speech. */
export const CHAR_S = 0.055;
/** Extra pause on sentence ends (in characters). */
const PAUSE_CHARS = 5;

const VOWELS = new Set("aeiouyàâäéèêëîïôöùûüœæ".split(""));

export type Utterance = { text: string; start: number };

export const speech: { current: Utterance | null } = { current: null };

/** Number of character slots the text takes, pauses included. */
export function utteranceLength(text: string): number {
  let n = 0;
  for (const ch of text) n += /[.!?…]/.test(ch) ? PAUSE_CHARS : 1;
  return n;
}

export const utteranceDuration = (text: string) => utteranceLength(text) * CHAR_S;

/** Starts speaking `text` at time `now` (seconds). */
export function say(text: string, now: number) {
  speech.current = { text, start: now };
}

/** Mouth opening 0..1 for an utterance at time `now`; 0 before, after, and between words. */
export function mouthOpenAt(u: Utterance | null, now: number): number {
  if (!u) return 0;
  const slot = (now - u.start) / CHAR_S;
  if (slot < 0) return 0;
  let at = 0;
  for (const ch of u.text) {
    const width = /[.!?…]/.test(ch) ? PAUSE_CHARS : 1;
    if (slot < at + width) {
      const c = ch.toLowerCase();
      const shape = VOWELS.has(c) ? 0.95 : /[a-zà-ÿ]/.test(c) ? 0.35 : 0;
      // A bump within the character's slot, so consecutive vowels still read as separate syllables.
      return shape * Math.sin(Math.PI * Math.min(Math.max((slot - at) / width, 0), 1));
    }
    at += width;
  }
  return 0;
}

/** True while the utterance is being spoken at `now`. */
export const isSpeaking = (u: Utterance | null, now: number) => !!u && now >= u.start && now < u.start + utteranceDuration(u.text);
