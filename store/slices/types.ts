import type { StateCreator } from "zustand";
import type { CartSlice } from "./cart";
import type { ProductSlice } from "./product";
import type { TryOnSlice } from "./tryOn";
import type { WorldSlice } from "./world";

export type AppState = WorldSlice & ProductSlice & CartSlice & TryOnSlice;

export type Slice<T> = StateCreator<AppState, [], [], T>;
