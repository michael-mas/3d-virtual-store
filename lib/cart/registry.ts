import type { Object3D } from "three";

/** Bridges between DOM and the R3F scene for cart features (no React context crosses the Canvas). */

let thumbnailRenderer: (() => Promise<Blob>) | null = null;
let cartIcon: HTMLElement | null = null;
const productModels = new Map<string, Object3D>();

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

/** The rendered model of each product (with its current materials), for thumbnails. */
export function setProductModel(productId: string, model: Object3D | null) {
  if (model) productModels.set(productId, model);
  else productModels.delete(productId);
}

export function getProductModel(productId: string): Object3D | undefined {
  return productModels.get(productId);
}
