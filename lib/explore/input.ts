import type { Vec2 } from "./layout";

/**
 * Keyboard state for walking. Uses `KeyboardEvent.code` (physical keys), so WASD on QWERTY and ZQSD on
 * AZERTY map to the same movement; arrow keys work too. Shift = run.
 */
const FORWARD = new Set(["KeyW", "ArrowUp"]);
const BACK = new Set(["KeyS", "ArrowDown"]);
const LEFT = new Set(["KeyA", "ArrowLeft"]);
const RIGHT = new Set(["KeyD", "ArrowRight"]);
const MOVE_KEYS = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT]);

const pressed = new Set<string>();

const isTyping = (e: Event) =>
  e.target instanceof HTMLElement && !!e.target.closest("input, textarea, select, [contenteditable]");

/** Attaches listeners; returns a detach function. */
export function bindKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (MOVE_KEYS.has(e.code) || e.code.startsWith("Shift")) {
      pressed.add(e.code);
      if (e.code.startsWith("Arrow")) e.preventDefault();
    }
  };
  const up = (e: KeyboardEvent) => pressed.delete(e.code);
  const clear = () => pressed.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", clear);
    document.removeEventListener("visibilitychange", clear);
    clear();
  };
}

const any = (keys: Set<string>) => [...keys].some((k) => pressed.has(k));

/** [strafe right, forward], each in -1..1. */
export function moveAxes(): Vec2 {
  return [(any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0), (any(FORWARD) ? 1 : 0) - (any(BACK) ? 1 : 0)];
}

export const isRunning = () => pressed.has("ShiftLeft") || pressed.has("ShiftRight");
