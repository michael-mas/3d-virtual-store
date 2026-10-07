import { ARTWORKS } from "./artworks";

/**
 * The gallery's passport: a stamp for every work the visitor touches (or, for the theatre, watches). Six stamps
 * unlock the Gold collection on every piece of the boutique, all eleven the Mirror collection. Kept in this
 * browser only (a per-visitor convenience: it may be lost with the site's data, nothing else depends on it).
 */

export const GOLD_AT = 6;
export const MIRROR_AT = ARTWORKS.length;
const KEY = "prisma-aurum-passport";

export const unlockedCollections = (stamps: readonly string[]) => ({ or: stamps.length >= GOLD_AT, miroir: stamps.length >= MIRROR_AT });

const known = new Set<string>(ARTWORKS.map((a) => a.id));

export function loadStamps(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === "string" && known.has(id)))] : [];
  } catch {
    return [];
  }
}

export function saveStamps(stamps: readonly string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stamps));
  } catch {
    // Storage unavailable: the passport lasts until reload.
  }
}
