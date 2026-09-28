import type { ProductConfig } from "@/lib/products";
import type { Slice } from "./types";

export type CartItem = {
  id: string;
  productId: string;
  config: ProductConfig;
};

export type CartSlice = {
  /** Cart drawer visibility — independent of `mode`. */
  cartOpen: boolean;
  items: CartItem[];
  setCartOpen: (open: boolean) => void;
  toggleCart: () => void;
  /** Adds the active product with its current configuration. */
  addToCart: () => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
};

export const createCartSlice: Slice<CartSlice> = (set, get) => ({
  cartOpen: false,
  items: [],
  setCartOpen: (cartOpen) => set({ cartOpen }),
  toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),
  addToCart: () => {
    const { activeProductId, configs } = get();
    const item: CartItem = {
      id: crypto.randomUUID(),
      productId: activeProductId,
      config: { ...configs[activeProductId] },
    };
    set((s) => ({ items: [...s.items, item] }));
  },
  removeFromCart: (itemId) => set((s) => ({ items: s.items.filter((i) => i.id !== itemId) })),
  clearCart: () => set({ items: [] }),
});
