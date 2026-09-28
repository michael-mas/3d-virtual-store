import type { ProductConfig } from "@/lib/products";
import type { Slice } from "./types";

export type CartItem = {
  id: string;
  productId: string;
  config: ProductConfig;
  /** Blob URL of a 256px render of this configuration; null until/unless rendered. */
  thumbnailUrl: string | null;
};

export type CartSlice = {
  /** Cart drawer visibility — independent of `mode`. */
  cartOpen: boolean;
  items: CartItem[];
  /** Incremented on every add; drives the fly-to-cart particles. */
  cartFxId: number;
  /** Incremented when the particles reach the cart icon; drives the icon bounce. */
  cartBumpId: number;
  bumpCart: () => void;
  setCartOpen: (open: boolean) => void;
  toggleCart: () => void;
  /** Adds the active product with its current configuration. Returns the new item id. */
  addToCart: (thumbnailUrl?: string | null) => string;
  /** Attaches a thumbnail once rendered; revokes it if the item is gone. */
  setItemThumbnail: (itemId: string, thumbnailUrl: string) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  /** Restores the item's configuration and navigates to TRY_ON through the transition table. */
  tryOnCartItem: (itemId: string) => void;
};

const revoke = (item: CartItem) => item.thumbnailUrl && URL.revokeObjectURL(item.thumbnailUrl);

export const createCartSlice: Slice<CartSlice> = (set, get) => ({
  cartOpen: false,
  items: [],
  cartFxId: 0,
  cartBumpId: 0,
  bumpCart: () => set((s) => ({ cartBumpId: s.cartBumpId + 1 })),
  setCartOpen: (cartOpen) => set({ cartOpen }),
  toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),
  addToCart: (thumbnailUrl = null) => {
    const { activeProductId, configs } = get();
    const item: CartItem = {
      id: crypto.randomUUID(),
      productId: activeProductId,
      config: { ...configs[activeProductId] },
      thumbnailUrl,
    };
    set((s) => ({ items: [...s.items, item], cartFxId: s.cartFxId + 1 }));
    return item.id;
  },
  setItemThumbnail: (itemId, thumbnailUrl) => {
    if (!get().items.some((i) => i.id === itemId)) {
      URL.revokeObjectURL(thumbnailUrl);
      return;
    }
    set((s) => ({ items: s.items.map((i) => (i.id === itemId ? { ...i, thumbnailUrl } : i)) }));
  },
  removeFromCart: (itemId) =>
    set((s) => {
      s.items.filter((i) => i.id === itemId).forEach(revoke);
      return { items: s.items.filter((i) => i.id !== itemId) };
    }),
  clearCart: () =>
    set((s) => {
      s.items.forEach(revoke);
      return { items: [] };
    }),
  tryOnCartItem: (itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    get().applyConfig(item.productId, item.config);
    set({ cartOpen: false });
    const { transition } = get();
    switch (get().mode) {
      case "EXPLORE":
        transition("INTERACT");
        transition("TRY_ON");
        break;
      case "CUSTOMIZE":
        transition("TRY_ON");
        break;
      case "PHOTO":
        transition("RETAKE");
        break;
      case "TRY_ON":
        break;
    }
  },
});
