"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal keyboard behaviour while `open`: moves focus into the dialog (to `initial` or its first focusable),
 * keeps Tab / Shift+Tab inside it, closes on Escape, and gives focus back to what had it before on close.
 */
export function useDialogFocus(
  container: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  initial?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const root = container.current;
    if (!open || !root) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    (initial?.current ?? focusables()[0] ?? root).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
    // onClose is intentionally not a dependency: re-running would steal focus back on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, container, initial]);
}
