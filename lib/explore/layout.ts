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

/**
 * Something the player walks around, on the floor plan: a capsule (the points within `radius` of segment a–b).
 * Pedestals and plants are circles (a = b); benches and consoles are capsules along their length, so the player
 * slides along them smoothly (a row of circles has notches where the slide catches).
 */
export type Obstacle = { a: Vec2; b: Vec2; radius: number };

const circle = (p: readonly number[], radius: number): Obstacle => ({ a: [p[0], p[1]], b: [p[0], p[1]], radius });

/** A capsule along a box's length (local x rotated by rotationY about +y), as thick as the box is deep. */
function lengthwise(center: readonly number[], length: number, depth: number, rotationY: number): Obstacle {
  const radius = depth / 2 + 0.025;
  const half = Math.max(length / 2 - radius, 0);
  const [ax, az] = [Math.cos(rotationY), -Math.sin(rotationY)];
  return {
    a: [center[0] - ax * half, center[1] - az * half],
    b: [center[0] + ax * half, center[1] + az * half],
    radius,
  };
}

function decorObstacles(): Obstacle[] {
  const { benches, bench, plants, plantCollisionRadius, consoles, console: table } = layout.decor;
  return [
    ...benches.map((b) => lengthwise(b.position, bench.length, bench.depth, b.rotationY)),
    ...plants.map((p) => circle(p, plantCollisionRadius)),
    ...consoles.map((c) => lengthwise(c, table.length, table.depth, 0)),
  ];
}

/** Everything the player walks around: pedestals and decor. */
export const OBSTACLES: readonly Obstacle[] = [
  ...PEDESTALS.map((p) => circle(p.position, layout.pedestal.collisionRadius)),
  ...decorObstacles(),
];
export const PLAYER_RADIUS = layout.playerRadius;
export const INTERACT_RADIUS = layout.interactRadius;

/** World position of a product's origin, resting on top of its pedestal. */
export function productPosition(productId: string): [number, number, number] {
  const p = PEDESTALS.find((x) => x.productId === productId);
  const y = PEDESTAL.top + PEDESTAL.productOffsetY;
  return p ? [p.position[0], y, p.position[1]] : [0, y, 0];
}
