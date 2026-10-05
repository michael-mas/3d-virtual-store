"use client";

import { useRef } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { formatPrice, priceBreakdown } from "@/lib/cart/pricing";
import { CATEGORY_LABELS, getProduct, TRY_ON_ZONES } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

const ZONE_LIST = TRY_ON_ZONES.map((z) => z.label.toLowerCase()).join(", ");

export default function CartDrawer() {
  const open = useAppStore((s) => s.cartOpen);
  const items = useAppStore((s) => s.items);
  const { setCartOpen, removeFromCart, tryOnCartItem, tryOnLook } = useAppStore.getState();
  const drawer = useRef<HTMLElement>(null);
  useDialogFocus(drawer, open, () => setCartOpen(false));

  const total = items.reduce((sum, i) => sum + priceBreakdown(i.productId, i.config).total, 0);

  return (
    <>
      <div
        aria-hidden
        onClick={() => setCartOpen(false)}
        className={`fixed inset-0 z-[55] bg-black/55 backdrop-blur-[2px] transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        ref={drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        aria-hidden={!open}
        inert={!open}
        className={`fixed top-0 right-0 z-[56] flex h-full w-[min(100vw,25rem)] flex-col border-l border-gold/25 bg-onyx text-ivory shadow-2xl transition-transform duration-500 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-gold/20 px-6 py-5">
          <h2 className="wordmark text-base">Your selection</h2>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Close cart"
            className="eyebrow px-1 py-1 hover:text-ivory"
          >
            Close
          </button>
        </header>

        <ul className="flex-1 divide-y divide-ivory/10 overflow-y-auto px-6">
          {items.length === 0 && (
            <li className="py-16 text-center">
              <p className="font-display text-xl italic">Your selection is empty.</p>
              <p className="mt-2 text-xs tracking-wide text-taupe">Pieces you add from the salon appear here.</p>
            </li>
          )}
          {items.map((item) => {
            const product = getProduct(item.productId);
            const price = priceBreakdown(item.productId, item.config);
            return (
              <li key={item.id} data-testid="cart-item" className="flex gap-4 py-5">
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob URL thumbnail
                  <img
                    src={item.thumbnailUrl}
                    alt={`${product?.name} thumbnail`}
                    width={96}
                    height={96}
                    className="size-24 shrink-0 rounded-sm bg-gradient-to-b from-[#26211b] to-[#16130f] object-cover ring-1 ring-gold/20"
                  />
                ) : (
                  <div className="size-24 shrink-0 rounded-sm bg-gradient-to-b from-[#26211b] to-[#16130f] ring-1 ring-gold/20" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  {product && <p className="eyebrow text-[0.6rem] text-gold">{CATEGORY_LABELS[product.category]}</p>}
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display text-lg leading-tight">{product?.name}</p>
                    <p className="font-display" data-testid="item-price">
                      {formatPrice(price.total)}
                    </p>
                  </div>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-taupe">
                    {price.lines.map((line) => {
                      const isColor = product?.options.find((o) => o.id === line.optionId)?.kind === "color";
                      return (
                        <div key={line.optionId} className="contents">
                          <dt>{line.label}</dt>
                          <dd className="flex items-center gap-1.5">
                            {isColor && (
                              <span
                                className="inline-block size-2.5 rounded-full ring-1 ring-ivory/30"
                                style={{ backgroundColor: item.config[line.optionId] }}
                              />
                            )}
                            {line.valueLabel}
                            {line.delta > 0 && ` (+${formatPrice(line.delta)})`}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <div className="mt-auto flex gap-4 pt-3">
                    <button
                      type="button"
                      onClick={() => tryOnCartItem(item.id)}
                      aria-label={`Try on ${product?.name ?? "item"}`}
                      className="eyebrow text-gold-light underline-offset-4 hover:underline"
                    >
                      Try on
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      aria-label={`Remove ${product?.name ?? "item"} from cart`}
                      className="eyebrow hover:text-ivory"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="space-y-4 border-t border-gold/20 px-6 py-5">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">Total</span>
            <span className="font-display text-2xl" data-testid="cart-total">
              {formatPrice(total)}
            </span>
          </div>
          {items.length > 1 && (
            <button
              type="button"
              onClick={tryOnLook}
              className="btn-gold w-full rounded-sm px-4 py-3"
            >
              Try on the whole look
              <span className="mt-0.5 block text-[0.65rem] font-normal tracking-wide normal-case opacity-70">
                One piece per zone: {ZONE_LIST}
              </span>
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}
