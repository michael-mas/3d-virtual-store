"use client";

import { formatPrice, priceOf } from "@/lib/cart/pricing";
import { renderThumbnail } from "@/lib/cart/registry";
import {
  getProduct,
  optionValueLabel,
  type ChoiceOption,
  type ColorOption,
  type OptionSchema,
  type RangeOption,
} from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";
import PhotoPicker from "./PhotoPicker";

const legendClass = "mb-1.5 text-xs font-medium tracking-wide text-neutral-400 uppercase";

function ChoiceControl({ option, value, onChange }: { option: ChoiceOption; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className={legendClass}>{option.label}</legend>
      <div
        className="grid gap-1 rounded-lg bg-neutral-800 p-1"
        // Up to 3 in a row; longer lists wrap into balanced rows (4 → 2×2).
        style={{ gridTemplateColumns: `repeat(${option.values.length <= 3 ? option.values.length : Math.ceil(option.values.length / 2)}, minmax(0, 1fr))` }}
      >
        {option.values.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={value === v.value}
            onClick={() => onChange(v.value)}
            className={`rounded-md px-2 py-1.5 text-sm transition-colors ${
              value === v.value ? "bg-white text-neutral-900" : "text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ColorControl({ option, value, onChange }: { option: ColorOption; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className={legendClass}>{option.label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {option.presets.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={`${option.label}: ${c.label}`}
            title={c.label}
            aria-pressed={value === c.value}
            onClick={() => onChange(c.value)}
            style={{ backgroundColor: c.value }}
            className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-neutral-900 ${
              value === c.value ? "ring-white" : "ring-transparent"
            }`}
          />
        ))}
        {option.allowCustom && (
          <input
            type="color"
            aria-label={`Custom ${option.label.toLowerCase()}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="size-7 cursor-pointer rounded-full bg-transparent"
          />
        )}
      </div>
    </fieldset>
  );
}

function RangeControl({ option, value, onChange }: { option: RangeOption; value: string; onChange: (v: string) => void }) {
  const id = `option-${option.id}`;
  return (
    <div>
      <label htmlFor={id} className={`${legendClass} flex justify-between`}>
        <span>{option.label}</span>
        <span className="text-neutral-200 normal-case">{optionValueLabel(option, value)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={option.min}
        max={option.max}
        step={option.step}
        value={value}
        aria-valuetext={optionValueLabel(option, value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-white"
      />
    </div>
  );
}

function OptionControl(props: { option: OptionSchema; value: string; onChange: (v: string) => void }) {
  const { option, value, onChange } = props;
  if (option.kind === "choice") return <ChoiceControl option={option} value={value} onChange={onChange} />;
  if (option.kind === "range") return <RangeControl option={option} value={value} onChange={onChange} />;
  return <ColorControl option={option} value={value} onChange={onChange} />;
}

/** CUSTOMIZE panel, generated from the active product's customization schema. */
export default function CustomizerPanel() {
  const mode = useAppStore((s) => s.mode);
  const config = useAppStore((s) => s.configs[s.activeProductId]);
  const productId = useAppStore((s) => s.activeProductId);
  const { setOption, transition, addToCart, setItemThumbnail } = useAppStore.getState();
  const product = getProduct(productId);

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
        <span className="pointer-coarse:hidden">
          <kbd className="font-mono">WASD</kbd> / <kbd className="font-mono">ZQSD</kbd> / arrows or scroll to walk ·
          Shift to run · drag to look around · click the floor to go there
        </span>
        <span className="hidden pointer-coarse:inline">Tap the floor to walk · drag to look around</span>
      </p>
    );
  }
  if (mode !== "CUSTOMIZE" || !product) return null;

  return (
    <aside
      aria-label={`Customize ${product.name}`}
      className="fixed bottom-4 left-1/2 z-40 max-h-[calc(100dvh-6rem)] w-[min(92vw,22rem)] -translate-x-1/2 space-y-4 overflow-y-auto rounded-2xl bg-neutral-900/85 p-4 text-neutral-100 shadow-2xl ring-1 ring-white/10 backdrop-blur md:top-1/2 md:right-6 md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2"
    >
      {product.options.map((o) => (
        <OptionControl key={o.id} option={o} value={config[o.id]} onChange={(v) => setOption(o.id, v)} />
      ))}

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
      <PhotoPicker className="w-full text-center text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline">
        No webcam? Try it on a photo
      </PhotoPicker>
    </aside>
  );
}
