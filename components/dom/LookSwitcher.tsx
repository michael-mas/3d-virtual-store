"use client";

import { itemsByZone } from "@/lib/cart/look";
import { getProduct } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

const CHIP = "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1 transition-colors";
const chipState = (selected: boolean) =>
  selected ? "bg-white text-neutral-900 ring-white" : "bg-neutral-900/70 text-neutral-200 ring-white/15 hover:bg-neutral-800";

/** The item's first color option, as a swatch (tells two configurations of the same product apart). */
function swatch(productId: string, config: Readonly<Record<string, string>>) {
  const option = getProduct(productId)?.options.find((o) => o.kind === "color");
  return option ? config[option.id] : null;
}

/**
 * TRY_ON with a look (the whole cart): one row per zone that has cart items, to pick which item is worn there or
 * leave the zone bare. Every change is instant: the products are already loaded and their materials compiled.
 */
export default function LookSwitcher() {
  const look = useAppStore((s) => s.look);
  const items = useAppStore((s) => s.items);
  const { wearLookItem, clearLookZone } = useAppStore.getState();
  if (!look) return null;

  return (
    <div
      role="group"
      aria-label="Look"
      data-testid="look-switcher"
      className="fixed bottom-20 left-1/2 z-40 w-[min(92vw,26rem)] -translate-x-1/2 space-y-2 rounded-2xl bg-black/50 p-3 backdrop-blur md:top-1/2 md:bottom-auto md:left-3 md:w-64 md:translate-x-0 md:-translate-y-1/2"
    >
      {itemsByZone(items).map((row) => (
        <div key={row.id} role="group" aria-label={row.label}>
          <p className="mb-1 text-[11px] font-medium tracking-wide text-neutral-300 uppercase">{row.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {row.items.map((item) => {
              const color = swatch(item.productId, item.config);
              const selected = look[row.id] === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => wearLookItem(item.id)}
                  className={`${CHIP} ${chipState(selected)}`}
                >
                  {color && (
                    <span aria-hidden className="size-2.5 rounded-full ring-1 ring-black/20" style={{ backgroundColor: color }} />
                  )}
                  {getProduct(item.productId)?.name}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={!look[row.id]}
              aria-label={`No ${row.label.toLowerCase()}`}
              onClick={() => clearLookZone(row.id)}
              className={`${CHIP} ${chipState(!look[row.id])}`}
            >
              None
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
