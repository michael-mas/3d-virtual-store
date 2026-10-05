"use client";

import { formatPrice, priceOf } from "@/lib/cart/pricing";
import { renderThumbnail } from "@/lib/cart/registry";
import {
  CATEGORY_LABELS,
  getProduct,
  optionValueLabel,
  type ChoiceOption,
  type ColorOption,
  type OptionSchema,
  type RangeOption,
} from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";
import PhotoPicker from "./PhotoPicker";

const legendClass = "eyebrow mb-2 block";

function ChoiceControl({ option, value, onChange }: { option: ChoiceOption; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className={legendClass}>{option.label}</legend>
      <div
        className="grid gap-px overflow-hidden rounded-sm border border-ivory/15 bg-ivory/15"
        // Up to 3 in a row; longer lists wrap into balanced rows (4 → 2×2).
        style={{ gridTemplateColumns: `repeat(${option.values.length <= 3 ? option.values.length : Math.ceil(option.values.length / 2)}, minmax(0, 1fr))` }}
      >
        {option.values.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={value === v.value}
            onClick={() => onChange(v.value)}
            className={`px-2 py-2 text-[0.8rem] tracking-wide transition-colors ${
              value === v.value ? "bg-ivory text-noir" : "bg-onyx text-ivory/75 hover:bg-[#1f1b16] hover:text-ivory"
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
      <div className="flex flex-wrap items-center gap-2.5">
        {option.presets.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={`${option.label}: ${c.label}`}
            title={c.label}
            aria-pressed={value === c.value}
            onClick={() => onChange(c.value)}
            style={{ backgroundColor: c.value }}
            className={`size-6 rounded-full shadow-[inset_0_1px_2px_rgb(255_255_255/0.25),inset_0_-2px_3px_rgb(0_0_0/0.35)] ring-1 ring-offset-[3px] ring-offset-onyx transition ${
              value === c.value ? "ring-gold" : "ring-ivory/10 hover:ring-ivory/40"
            }`}
          />
        ))}
        {option.allowCustom && (
          <input
            type="color"
            aria-label={`Custom ${option.label.toLowerCase()}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="size-6 cursor-pointer rounded-full bg-transparent"
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
        <span className="text-ivory tracking-normal normal-case">{optionValueLabel(option, value)}</span>
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
        className="w-full accent-gold"
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
      <p className="pointer-events-none fixed inset-x-0 bottom-7 px-4 text-center text-[0.7rem] tracking-[0.14em] text-ivory/60 uppercase">
        <span className="pointer-coarse:hidden">
          <kbd className="text-gold-light">WASD</kbd> / <kbd className="text-gold-light">ZQSD</kbd> / arrows or scroll to walk ·
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
      className="panel fixed bottom-3 left-1/2 z-40 max-h-[52dvh] w-[min(94vw,22rem)] -translate-x-1/2 space-y-4 overflow-y-auto rounded-sm p-4 md:top-1/2 md:max-h-[calc(100dvh-6rem)] md:space-y-5 md:p-5 md:right-8 md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2"
    >
      <header className="flex items-end justify-between gap-3 border-b border-gold/20 pb-3 md:block md:pb-4 md:text-center">
        <div>
          <p className="eyebrow text-gold">{CATEGORY_LABELS[product.category]}</p>
          <h2 className="mt-1 font-display text-xl leading-none font-medium tracking-wide md:mt-1.5 md:text-[1.65rem]">
            {product.name}
          </h2>
        </div>
        <p className="font-display text-base text-ivory/80 italic md:mt-2">{formatPrice(priceOf(productId, config))}</p>
        {product.tagline && (
          <p className="mt-2 hidden text-xs leading-relaxed tracking-wide text-taupe md:block">{product.tagline}</p>
        )}
      </header>
      {product.options.map((o) => (
        <OptionControl key={o.id} option={o} value={config[o.id]} onChange={(v) => setOption(o.id, v)} />
      ))}

      <button
        type="button"
        onClick={onAddToCart}
        className="btn-gold flex w-full items-center justify-between rounded-sm px-4 py-3"
      >
        <span>Add to cart</span>
        <span data-testid="config-price" className="font-display text-sm tracking-normal normal-case">
          {formatPrice(priceOf(productId, config))}
        </span>
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => transition("BACK")}
          className="btn-line flex-1 rounded-sm px-3 py-2.5"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => transition("TRY_ON")}
          className="btn-line flex-1 rounded-sm border-gold/60 px-3 py-2.5 text-gold-light"
        >
          Try on
        </button>
      </div>
      <PhotoPicker className="w-full text-center text-xs tracking-wide text-taupe underline-offset-4 hover:text-ivory hover:underline">
        No webcam? Try it on a photo
      </PhotoPicker>
    </aside>
  );
}
