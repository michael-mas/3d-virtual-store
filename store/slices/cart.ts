import { clearZone, defaultLook, lookItems, wearItem, withoutItem, type Look } from "@/lib/cart/look";
import type { ProductConfig, TryOnZone } from "@/lib/products";
import type { AppState, Slice } from "./types";

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
  /** Products worn together in try-on, one cart item per zone; null when trying on a single product. */
  look: Look | null;
  /** Tries on the whole cart: the latest item of each zone, all at once. */
  tryOnLook: () => void;
  /** Wears a cart item in its zone of the current look (replacing the item there). */
  wearLookItem: (itemId: string) => void;
  /** Leaves a zone of the current look bare. */
  clearLookZone: (zone: TryOnZone) => void;
};

const revoke = (item: CartItem) => item.thumbnailUrl && URL.revokeObjectURL(item.thumbnailUrl);

/** EXPLORE / CUSTOMIZE / PHOTO → TRY_ON through the transition table (TRY_ON stays). */
function goToTryOn(get: () => AppState) {
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
}

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
      return { items: s.items.filter((i) => i.id !== itemId), look: s.look && withoutItem(s.look, itemId) };
    }),
  clearCart: () =>
    set((s) => {
      s.items.forEach(revoke);
      return { items: [], look: s.look && {} };
    }),
  tryOnCartItem: (itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    get().applyConfig(item.productId, item.config);
    set({ cartOpen: false, look: null });
    goToTryOn(get);
  },
  look: null,
  tryOnLook: () => {
    const { items } = get();
    const look = defaultLook(items);
    const worn = lookItems(look, items);
    if (worn.length === 0) return;
    for (const item of worn) get().setConfig(item.productId, item.config);
    // The last worn item (eyewear first, when present) becomes the active product: calibration, and where EXIT
    // returns to.
    set({ activeProductId: worn[worn.length - 1].productId, cartOpen: false });
    goToTryOn(get);
    // After navigating: leaving the try-on modes clears the look, and INTERACT passes through CUSTOMIZE.
    set({ look });
  },
  wearLookItem: (itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    const look = get().look;
    if (!item || !look) return;
    get().setConfig(item.productId, item.config);
    set({ look: wearItem(look, item) });
  },
  clearLookZone: (zone) => {
    const look = get().look;
    if (look) set({ look: clearZone(look, zone) });
  },
});
