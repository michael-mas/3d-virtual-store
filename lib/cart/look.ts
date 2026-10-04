import { getProduct, TRY_ON_ZONES, type TryOnZone } from "@/lib/products";

/** A look: the cart item worn in each zone (at most one per zone, a zone may be empty). */
export type Look = Partial<Record<TryOnZone, string>>;

type Item = { id: string; productId: string };

export const zoneOf = (productId: string): TryOnZone | undefined => getProduct(productId)?.zone;

/** The look a "try on the whole cart" starts with: the most recently added item in each zone. */
export function defaultLook(items: readonly Item[]): Look {
  const look: Look = {};
  for (const item of items) {
    const zone = zoneOf(item.productId);
    if (zone) look[zone] = item.id;
  }
  return look;
}

/** Wears `item` in its zone, replacing whatever was there. */
export function wearItem(look: Look, item: Item): Look {
  const zone = zoneOf(item.productId);
  return zone ? { ...look, [zone]: item.id } : look;
}

/** Leaves `zone` bare. */
export function clearZone(look: Look, zone: TryOnZone): Look {
  const next = { ...look };
  delete next[zone];
  return next;
}

/** Drops the item from the look if it is worn (e.g. it was removed from the cart). */
export function withoutItem(look: Look, itemId: string): Look {
  return Object.fromEntries(Object.entries(look).filter(([, id]) => id !== itemId));
}

/** The worn items, in zone drawing order (skin, lips, eyewear). */
export function lookItems<T extends Item>(look: Look, items: readonly T[]): T[] {
  return TRY_ON_ZONES.flatMap(({ id }) => items.filter((i) => i.id === look[id]));
}

/** Cart items grouped by zone (zone order), only zones that have items: the look switcher's rows. */
export function itemsByZone<T extends Item>(items: readonly T[]) {
  return TRY_ON_ZONES.map((zone) => ({ ...zone, items: items.filter((i) => zoneOf(i.productId) === zone.id) })).filter(
    (row) => row.items.length > 0,
  );
}

/**
 * Products drawn in try-on: the look's products when a look is worn, otherwise the single active product.
 * At most one product per zone either way.
 */
export function wornProductIds(state: { look: Look | null; items: readonly Item[]; activeProductId: string }): string[] {
  return state.look ? lookItems(state.look, state.items).map((i) => i.productId) : [state.activeProductId];
}
