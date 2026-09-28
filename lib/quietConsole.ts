import { setConsoleFunction } from "three/webgpu";
import { isDebugEnabled } from "./debug";

const noop = () => {};

/**
 * Production console hygiene for third-party libraries (dev and `?debug` keep everything):
 * three.js deprecation/fallback warnings (e.g. R3F's internal THREE.Clock, "running under WebGL2 backend")
 * are dropped; three's errors still reach the console.
 */
export function quietThreeConsole() {
  if (typeof window === "undefined" || isDebugEnabled()) return;
  setConsoleFunction((type: string, message: string, ...params: unknown[]) => {
    if (type === "error") console.error(message, ...params);
  });
}

/**
 * MediaPipe's WASM prints native glog lines (graph start, GL version, XNNPACK delegate) to the console.
 * tasks-vision passes a pre-existing global `Module` to the Emscripten factory, whose standard `print` /
 * `printErr` hooks receive that output. Must be set right before each `createFromOptions` (MediaPipe clears it).
 */
export function silenceMediaPipeModule() {
  if (isDebugEnabled()) return;
  const g = globalThis as { Module?: object; dbg?: (...args: unknown[]) => void };
  g.Module = { print: noop, printErr: noop };
  // glog warnings (W… lines) bypass print/printErr: the loader's custom_emscripten_dbgn calls a global `dbg` if
  // one exists, else console.warn. They are also emitted after init (first detection), so this one stays set.
  g.dbg ??= noop;
}
