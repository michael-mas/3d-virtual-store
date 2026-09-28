"use client";

import { useEffect, useState } from "react";
import { setCartIcon } from "@/lib/cart/registry";
import { useAppStore } from "@/store/useAppStore";

/** Cart icon (particle target) with item count; bounces when the add-to-cart particles land. */
export default function CartButton() {
  const count = useAppStore((s) => s.items.length);
  const bumpId = useAppStore((s) => s.cartBumpId);
  const toggleCart = useAppStore((s) => s.toggleCart);
  const [bumping, setBumping] = useState(false);

  useEffect(() => {
    if (bumpId === 0) return;
    const start = requestAnimationFrame(() => setBumping(true));
    const end = setTimeout(() => setBumping(false), 350);
    return () => {
      cancelAnimationFrame(start);
      clearTimeout(end);
    };
  }, [bumpId]);

  return (
    <button
      type="button"
      onClick={toggleCart}
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      className="fixed top-3 right-3 z-50 rounded-full bg-neutral-900/85 p-3 text-white shadow-lg ring-1 ring-white/10 hover:bg-neutral-800"
    >
      <span
        ref={setCartIcon}
        data-testid="cart-icon"
        className={`block transition-transform duration-300 ${bumping ? "scale-125" : "scale-100"}`}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9.5" cy="19.5" r="1.3" />
          <circle cx="17" cy="19.5" r="1.3" />
        </svg>
      </span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-indigo-500 px-1.5 text-center text-xs leading-5 font-semibold">
          {count}
        </span>
      )}
    </button>
  );
}
