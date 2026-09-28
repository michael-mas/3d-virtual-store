/** Bridges between DOM and the R3F scene for cart features (no React context crosses the Canvas). */

let thumbnailRenderer: (() => Promise<Blob>) | null = null;
let cartIcon: HTMLElement | null = null;

export function setThumbnailRenderer(fn: (() => Promise<Blob>) | null) {
  thumbnailRenderer = fn;
}

/** Renders the active product (current config) to a 256px PNG. */
export function renderThumbnail(): Promise<Blob> {
  return thumbnailRenderer ? thumbnailRenderer() : Promise.reject(new Error("Thumbnail renderer not ready"));
}

export function setCartIcon(el: HTMLElement | null) {
  cartIcon = el;
}

export function getCartIcon(): HTMLElement | null {
  return cartIcon;
}
