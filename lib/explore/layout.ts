import { PRODUCTS } from "@/lib/products";
import layout from "./showroom-layout.json";

export type Vec2 = [number, number];

export type Pedestal = { productId: string; position: Vec2 };

export const FLOOR_Y = layout.floorY;
export const ROOM = layout.room;
export const PEDESTAL = layout.pedestal;
/** Registry products placed on the showroom's pedestal slots, in registry order. */
export const PEDESTALS: readonly Pedestal[] = PRODUCTS.map((product, i) => {
  const slot = layout.slots[i];
  if (!slot) throw new Error(`No showroom slot for product "${product.id}": add one to showroom-layout.json`);
  return { productId: product.id, position: [slot.position[0], slot.position[1]] as Vec2 };
});
export const SPAWN: Vec2 = [layout.spawn[0], layout.spawn[1]];
export const PLAYER_RADIUS = layout.playerRadius;
export const INTERACT_RADIUS = layout.interactRadius;

/** World position of a product's origin, resting on top of its pedestal. */
export function productPosition(productId: string): [number, number, number] {
  const p = PEDESTALS.find((x) => x.productId === productId);
  const y = PEDESTAL.top + PEDESTAL.productOffsetY;
  return p ? [p.position[0], y, p.position[1]] : [0, y, 0];
}
