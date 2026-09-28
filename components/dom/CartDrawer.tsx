"use client";

import { formatPrice, priceBreakdown } from "@/lib/cart/pricing";
import { getProduct } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

export default function CartDrawer() {
  const open = useAppStore((s) => s.cartOpen);
  const items = useAppStore((s) => s.items);
  const { setCartOpen, removeFromCart, tryOnCartItem } = useAppStore.getState();

  const total = items.reduce((sum, i) => sum + priceBreakdown(i.productId, i.config).total, 0);

  return (
    <>
      <div
        aria-hidden
        onClick={() => setCartOpen(false)}
        className={`fixed inset-0 z-[55] bg-black/40 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-label="Cart"
        aria-hidden={!open}
        inert={!open}
        className={`fixed top-0 right-0 z-[56] flex h-full w-[min(100vw,24rem)] flex-col bg-neutral-900 text-neutral-100 shadow-2xl ring-1 ring-white/10 transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold">Cart</h2>
          <button type="button" onClick={() => setCartOpen(false)} className="text-sm text-neutral-400 hover:text-white">
            Close
          </button>
        </header>

        <ul className="flex-1 space-y-3 overflow-y-auto p-4">
          {items.length === 0 && <li className="text-sm text-neutral-400">Your cart is empty.</li>}
          {items.map((item) => {
            const product = getProduct(item.productId);
            const price = priceBreakdown(item.productId, item.config);
            return (
              <li key={item.id} data-testid="cart-item" className="flex gap-3 rounded-xl bg-neutral-800/60 p-3">
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob URL thumbnail
                  <img
                    src={item.thumbnailUrl}
                    alt={`${product?.name} thumbnail`}
                    width={96}
                    height={96}
                    className="size-24 shrink-0 rounded-lg bg-neutral-700 object-cover"
                  />
                ) : (
                  <div className="size-24 shrink-0 rounded-lg bg-neutral-700" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{product?.name}</p>
                    <p className="font-medium" data-testid="item-price">
                      {formatPrice(price.total)}
                    </p>
                  </div>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-xs text-neutral-400">
                    <dt>Finish</dt>
                    <dd className="capitalize">
                      {item.config.finish}
                      {price.finish > 0 && ` (+${formatPrice(price.finish)})`}
                    </dd>
                    <dt>Color</dt>
                    <dd className="flex items-center gap-1.5">
                      <span className="inline-block size-3 rounded-full ring-1 ring-white/30" style={{ backgroundColor: item.config.frameColor }} />
                      {item.config.frameColor}
                    </dd>
                    <dt>Lens</dt>
                    <dd className="capitalize">
                      {item.config.lens}
                      {price.lens > 0 && ` (+${formatPrice(price.lens)})`}
                    </dd>
                  </dl>
                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => tryOnCartItem(item.id)}
                      className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium hover:bg-indigo-500"
                    >
                      Try On
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="rounded-md px-2 py-1 text-xs text-neutral-400 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="flex items-center justify-between border-t border-white/10 p-4">
          <span className="text-sm text-neutral-400">Total</span>
          <span className="text-lg font-semibold" data-testid="cart-total">
            {formatPrice(total)}
          </span>
        </footer>
      </aside>
    </>
  );
}
