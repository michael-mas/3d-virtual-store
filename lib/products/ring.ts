import type { Finger } from "@/lib/tryon/handPose";
import type { OptionSchema, Product } from "./types";

export const RING_METALS = ["yellow-gold", "white-gold", "rose-gold", "platinum"] as const;
export const RING_STONES = ["diamond", "ruby", "emerald", "sapphire", "none"] as const;
export const RING_FINGERS = ["index", "middle", "ring", "pinky"] as const satisfies readonly Finger[];
export type RingMetal = (typeof RING_METALS)[number];
export type RingStone = (typeof RING_STONES)[number];

/** Customization schema shared by every ring product. The finger is part of the configuration. */
export const RING_OPTIONS: readonly OptionSchema[] = [
  {
    kind: "choice",
    id: "metal",
    label: "Metal",
    default: "yellow-gold",
    values: [
      { value: "yellow-gold", label: "Yellow gold" },
      { value: "white-gold", label: "White gold" },
      { value: "rose-gold", label: "Rose gold", priceDelta: 20 },
      { value: "platinum", label: "Platinum", priceDelta: 80 },
    ],
  },
  {
    kind: "choice",
    id: "stone",
    label: "Stone",
    default: "diamond",
    values: [
      { value: "diamond", label: "Diamond", priceDelta: 150 },
      { value: "ruby", label: "Ruby", priceDelta: 90 },
      { value: "emerald", label: "Emerald", priceDelta: 90 },
      { value: "sapphire", label: "Sapphire", priceDelta: 110 },
      { value: "none", label: "None" },
    ],
  },
  {
    kind: "choice",
    id: "finger",
    label: "Finger",
    default: "ring",
    values: [
      { value: "index", label: "Index" },
      { value: "middle", label: "Middle" },
      { value: "ring", label: "Ring" },
      { value: "pinky", label: "Pinky" },
    ],
  },
];

/** Typed view of a (validated) ring configuration. */
export type RingConfig = { metal: RingMetal; stone: RingStone; finger: Finger };
export const readRingConfig = (c: Readonly<Record<string, string>>): RingConfig => ({
  metal: c.metal as RingMetal,
  stone: c.stone as RingStone,
  finger: c.finger as Finger,
});

/** A ring: worn on the chosen finger, pinned to the tracked hand (HandLandmarker). */
export function ringProduct(p: { id: string; name: string; basePrice: number }): Product {
  return {
    id: p.id,
    name: p.name,
    category: "ring",
    attachment: "landmark",
    zone: "finger",
    renderer: "ring",
    basePrice: p.basePrice,
    options: RING_OPTIONS,
    calibration: { offset: [0, 0, 0], scale: 1 },
  };
}
