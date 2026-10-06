"use client";

import { itemsByZone } from "@/lib/cart/look";
import { getProduct } from "@/lib/products";
import { useT } from "@/hooks/useT";
import { useAppStore } from "@/store/useAppStore";

const CHIP = "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs tracking-wide ring-1 transition-colors";
const chipState = (selected: boolean) =>
  selected ? "bg-ivory text-noir ring-ivory" : "bg-noir/60 text-ivory/80 ring-gold/25 hover:ring-gold/60";

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
  const t = useT();
  if (!look) return null;

  return (
    <div
      role="group"
      aria-label={t("Look")}
      data-testid="look-switcher"
      className="fixed bottom-[7.5rem] left-1/2 z-40 max-h-[40dvh] overflow-y-auto w-[min(92vw,26rem)] -translate-x-1/2 panel space-y-3 rounded-sm p-4 md:top-1/2 md:bottom-auto md:left-6 md:w-64 md:translate-x-0 md:-translate-y-1/2"
    >
      {itemsByZone(items).map((row) => (
        <div key={row.id} role="group" aria-label={t(row.label)}>
          <p className="eyebrow mb-1.5 text-[0.6rem]">{t(row.label)}</p>
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
              aria-label={t("No {zone}", { zone: t(row.label).toLowerCase() })}
              onClick={() => clearLookZone(row.id)}
              className={`${CHIP} ${chipState(!look[row.id])}`}
            >
              {t("None")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
