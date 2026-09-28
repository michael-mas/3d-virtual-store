import { create } from "zustand";
import { createCartSlice } from "./slices/cart";
import { createProductSlice } from "./slices/product";
import { createTryOnSlice } from "./slices/tryOn";
import type { AppState } from "./slices/types";
import { createWorldSlice } from "./slices/world";

export type { AppState } from "./slices/types";
export type { RenderBackend } from "./slices/world";
export type { TryOnSource, TryOnStatus } from "./slices/tryOn";

export const useAppStore = create<AppState>()((...a) => ({
  ...createWorldSlice(...a),
  ...createProductSlice(...a),
  ...createCartSlice(...a),
  ...createTryOnSlice(...a),
}));
