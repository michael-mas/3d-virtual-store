"use client";

import { useEffect, useState } from "react";
import { setCartIcon } from "@/lib/cart/registry";
import { useT } from "@/hooks/useT";
import { useAppStore } from "@/store/useAppStore";

/** Cart icon (particle target) with item count; bounces when the add-to-cart particles land. */
export default function CartButton() {
  const count = useAppStore((s) => s.items.length);
  const bumpId = useAppStore((s) => s.cartBumpId);
  const toggleCart = useAppStore((s) => s.toggleCart);
  const [bumping, setBumping] = useState(false);
  const t = useT();

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
      aria-label={t(count === 1 ? "Cart, {count} item" : "Cart, {count} items", { count })}
      className="chip relative rounded-full p-3"
    >
      <span
        ref={setCartIcon}
        data-testid="cart-icon"
        className={`block transition-transform duration-300 ${bumping ? "scale-125" : "scale-100"}`}
      >
        {/* A shopping bag, drawn with hairlines. */}
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.2} aria-hidden>
          <path d="M5 8h14l-1 12.5H6L5 8Z" strokeLinejoin="round" />
          <path d="M9 10.5V6.5a3 3 0 0 1 6 0v4" strokeLinecap="round" />
        </svg>
      </span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-gold px-1.5 text-center font-display text-xs leading-5 tracking-normal text-noir">
          {count}
        </span>
      )}
    </button>
  );
}
