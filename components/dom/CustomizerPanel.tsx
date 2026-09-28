"use client";

import { formatPrice, priceOf } from "@/lib/cart/pricing";
import { renderThumbnail } from "@/lib/cart/registry";
import type { FrameFinish, LensEffect } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

const FINISHES: FrameFinish[] = ["matte", "metal", "glass"];
const LENSES: LensEffect[] = ["clear", "iridescent", "holographic"];
const SWATCHES = ["#111827", "#c9a44c", "#b91c1c", "#1d4ed8", "#e5e7eb", "#7c3aed"];

function Segmented<T extends string>(props: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-neutral-400 uppercase">{props.label}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-800 p-1">
        {props.options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={props.value === o}
            onClick={() => props.onChange(o)}
            className={`rounded-md px-2 py-1.5 text-sm capitalize transition-colors ${
              props.value === o ? "bg-white text-neutral-900" : "text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function CustomizerPanel() {
  const mode = useAppStore((s) => s.mode);
  const config = useAppStore((s) => s.configs[s.activeProductId]);
  const productId = useAppStore((s) => s.activeProductId);
  const { setFinish, setFrameColor, setLensEffect, transition, addToCart, setItemThumbnail } = useAppStore.getState();

  const onAddToCart = () => {
    // The thumbnail is rendered synchronously here (same config as the item); only readback is async.
    const thumbnail = renderThumbnail();
    const itemId = addToCart();
    thumbnail
      .then((blob) => setItemThumbnail(itemId, URL.createObjectURL(blob)))
      .catch((error: unknown) => console.warn("[cart] thumbnail failed", error));
  };

  if (mode === "EXPLORE") {
    return (
      <p className="pointer-events-none fixed inset-x-0 bottom-8 px-4 text-center text-sm text-neutral-300">
        <kbd className="font-mono">WASD</kbd> / <kbd className="font-mono">ZQSD</kbd> / arrows or scroll to walk ·
        Shift to run · drag to look around · click the floor to go there
      </p>
    );
  }
  if (mode !== "CUSTOMIZE") return null;

  return (
    <aside className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,22rem)] -translate-x-1/2 space-y-4 rounded-2xl bg-neutral-900/85 p-4 text-neutral-100 shadow-2xl ring-1 ring-white/10 backdrop-blur md:top-1/2 md:right-6 md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2">
      <Segmented label="Frame finish" options={FINISHES} value={config.finish} onChange={setFinish} />

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium tracking-wide text-neutral-400 uppercase">Frame color</legend>
        <div className="flex items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={config.frameColor === c}
              onClick={() => setFrameColor(c)}
              style={{ backgroundColor: c }}
              className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-neutral-900 ${
                config.frameColor === c ? "ring-white" : "ring-transparent"
              }`}
            />
          ))}
          <input
            type="color"
            aria-label="Custom color"
            value={config.frameColor}
            onChange={(e) => setFrameColor(e.target.value)}
            className="size-7 cursor-pointer rounded-full bg-transparent"
          />
        </div>
      </fieldset>

      <Segmented label="Lens" options={LENSES} value={config.lens} onChange={setLensEffect} />

      <button
        type="button"
        onClick={onAddToCart}
        className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
      >
        <span>Add to cart</span>
        <span data-testid="config-price">{formatPrice(priceOf(productId, config))}</span>
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => transition("BACK")}
          className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => transition("TRY_ON")}
          className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          Try on
        </button>
      </div>
    </aside>
  );
}
