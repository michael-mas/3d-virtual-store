import layout from "./showroom-layout.json";

export type Vec2 = [number, number];

export type Pedestal = { productId: string; position: Vec2 };

export const FLOOR_Y = layout.floorY;
export const ROOM = layout.room;
export const PEDESTAL = layout.pedestal;
export const PEDESTALS: readonly Pedestal[] = layout.pedestals.map((p) => ({
  productId: p.productId,
  position: [p.position[0], p.position[1]] as Vec2,
}));
export const SPAWN: Vec2 = [layout.spawn[0], layout.spawn[1]];
export const PLAYER_RADIUS = layout.playerRadius;
export const INTERACT_RADIUS = layout.interactRadius;

/** World position of a product's origin (lens centre), resting on top of its pedestal. */
export function productPosition(productId: string): [number, number, number] {
  const p = PEDESTALS.find((x) => x.productId === productId);
  const y = PEDESTAL.top + PEDESTAL.productOffsetY;
  return p ? [p.position[0], y, p.position[1]] : [0, y, 0];
}
