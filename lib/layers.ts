/**
 * Render layers. Transmissive materials (glass frames, lenses) sample a screen copy that three.js r186 shares
 * between renders; rendering them at another size (the floor reflection is half resolution) frees that copy while
 * the main pass's bindings still use it, and WebGPU rejects every following frame ("Destroyed texture used in a
 * submit"): the view freezes. They live on this layer, seen by every camera except the reflection's.
 */
export const NO_REFLECTION_LAYER = 3;
