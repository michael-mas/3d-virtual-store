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

export type Obstacle = { position: Vec2; radius: number };

/** Benches and consoles as rows of circles along their length, plants as one circle (collisions are circle push-outs). */
function decorObstacles(): Obstacle[] {
  const { benches, bench, plants, plantCollisionRadius } = layout.decor;
  const out: Obstacle[] = [];
  const radius = bench.depth / 2 + 0.025;
  const count = Math.ceil(bench.length / (radius * 2));
  for (const { position: [x, z], rotationY } of benches) {
    // Local x (length axis) rotated by rotationY about +y: (cos, -sin) in (x, z).
    const [ax, az] = [Math.cos(rotationY), -Math.sin(rotationY)];
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1) - 0.5) * (bench.length - radius * 2);
      out.push({ position: [x + ax * t, z + az * t], radius });
    }
  }
  for (const [x, z] of plants) out.push({ position: [x, z], radius: plantCollisionRadius });
  // Consoles against the entrance wall: a row of circles along x.
  const { consoles, console: table } = layout.decor;
  const r = table.depth / 2 + 0.025;
  const n = Math.ceil(table.length / (r * 2));
  for (const [x, z] of consoles) {
    for (let i = 0; i < n; i++) out.push({ position: [x + (i / (n - 1) - 0.5) * (table.length - r * 2), z], radius: r });
  }
  return out;
}

/** Everything the player walks around: pedestals and decor. */
export const OBSTACLES: readonly Obstacle[] = [
  ...PEDESTALS.map((p) => ({ position: p.position, radius: layout.pedestal.collisionRadius })),
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
