"use client";

import { useRef, type ReactNode, type Ref } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * A button that opens the device's file picker (or camera roll on mobile) and tries the worn products on the chosen
 * photo. The image is decoded in the browser and never uploaded.
 */
export default function PhotoPicker({
  className,
  children,
  buttonRef,
}: {
  className: string;
  children: ReactNode;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => input.current?.click()} className={className}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        data-testid="photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so picking the same file again still fires a change.
          e.target.value = "";
          if (file) useAppStore.getState().tryOnWithPhoto(file);
        }}
      />
    </>
  );
}
