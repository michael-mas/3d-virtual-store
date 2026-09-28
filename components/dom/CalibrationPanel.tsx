"use client";

import { useSyncExternalStore } from "react";
import { isDebugEnabled } from "@/lib/debug";
import { isTryOnMode } from "@/lib/modes";
import { getProduct } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

const subscribe = () => () => {};
const MM = 0.001;

const AXES = [
  { key: 0, label: "offset x" },
  { key: 1, label: "offset y" },
  { key: 2, label: "offset z" },
] as const;

/** Dev-only sliders for the active product's try-on calibration. */
export default function CalibrationPanel() {
  const visible = useSyncExternalStore(subscribe, isDebugEnabled, () => false);
  const tryOn = useAppStore((s) => isTryOnMode(s.mode));
  const productId = useAppStore((s) => s.activeProductId);
  const calibration = useAppStore((s) => s.calibrations[s.activeProductId]);
  const setCalibration = useAppStore((s) => s.setCalibration);
  const surfaceDebug = useAppStore((s) => s.surfaceDebug);
  const setSurfaceDebug = useAppStore((s) => s.setSurfaceDebug);

  if (!visible || !tryOn) return null;

  const setOffset = (axis: 0 | 1 | 2, mm: number) => {
    const offset: [number, number, number] = [...calibration.offset];
    offset[axis] = mm * MM;
    setCalibration(productId, { offset });
  };
  const reset = () => {
    const defaults = getProduct(productId)?.calibration;
    if (defaults) setCalibration(productId, { offset: [...defaults.offset], scale: defaults.scale });
  };

  return (
    <div className="fixed top-20 right-3 z-50 w-64 space-y-2 rounded-lg bg-neutral-900/90 p-3 font-mono text-xs text-neutral-200 ring-1 ring-white/10">
      <div className="flex justify-between text-neutral-400">
        <span>calibration · {productId}</span>
        <button type="button" onClick={reset} className="hover:text-white">
          reset
        </button>
      </div>
      {AXES.map(({ key, label }) => {
        const mm = calibration.offset[key] / MM;
        return (
          <label key={key} className="block">
            <span className="flex justify-between">
              {label} <span>{mm.toFixed(1)} mm</span>
            </span>
            <input
              type="range"
              min={-20}
              max={20}
              step={0.5}
              value={mm}
              onChange={(e) => setOffset(key, Number(e.target.value))}
              className="w-full"
            />
          </label>
        );
      })}
      <label className="block">
        <span className="flex justify-between">
          scale <span>{calibration.scale.toFixed(3)}</span>
        </span>
        <input
          type="range"
          min={0.8}
          max={1.25}
          step={0.005}
          value={calibration.scale}
          onChange={(e) => setCalibration(productId, { scale: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
        <span className="text-neutral-400">surface</span>
        <div className="flex gap-1">
          {(["off", "uv", "luma"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={surfaceDebug === m}
              onClick={() => setSurfaceDebug(m)}
              className={`rounded px-2 py-0.5 ${surfaceDebug === m ? "bg-indigo-600" : "bg-neutral-800 hover:bg-neutral-700"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <pre className="overflow-x-auto text-[10px] text-neutral-400">
        {`calibration: { offset: [${calibration.offset.map((v) => +v.toFixed(4)).join(", ")}], scale: ${+calibration.scale.toFixed(3)} }`}
      </pre>
    </div>
  );
}
