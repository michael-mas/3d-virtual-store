import type { StateCreator } from "zustand";
import type { CartSlice } from "./cart";
import type { LocaleSlice } from "./locale";
import type { ProductSlice } from "./product";
import type { TryOnSlice } from "./tryOn";
import type { WorldSlice } from "./world";

export type AppState = WorldSlice & ProductSlice & CartSlice & TryOnSlice & LocaleSlice;

export type Slice<T> = StateCreator<AppState, [], [], T>;
