"use client";

import { useSyncExternalStore } from "react";
import { isDebugEnabled } from "@/lib/debug";
import { MODE_EVENTS, nextMode } from "@/lib/modes";
import { useAppStore } from "@/store/useAppStore";

const subscribe = () => () => {};

/** Debug controls for mode transitions and the cart drawer. Dev only (or `?debug` in production). */
export default function DevPanel() {
  const visible = useSyncExternalStore(subscribe, isDebugEnabled, () => false);
  const mode = useAppStore((s) => s.mode);
  const cartOpen = useAppStore((s) => s.cartOpen);
  const transition = useAppStore((s) => s.transition);
  const toggleCart = useAppStore((s) => s.toggleCart);
  const postFx = useAppStore((s) => s.postFx);
  const setPostFx = useAppStore((s) => s.setPostFx);
  const stats = useAppStore((s) => s.frameStats);

  if (!visible) return null;

  return (
    <div className="fixed top-3 left-3 z-50 w-64 rounded-lg bg-neutral-900/90 p-3 font-mono text-xs text-neutral-200 shadow-lg ring-1 ring-white/10">
      <div className="mb-2 flex justify-between">
        <span className="text-neutral-400">mode</span>
        <span data-testid="mode">{mode}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {MODE_EVENTS.map((event) => {
          const target = nextMode(mode, event);
          return (
            <button
              key={event}
              type="button"
              onClick={() => transition(event)}
              title={target ? `→ ${target}` : "invalid in this mode (logged, ignored)"}
              className={`rounded px-2 py-1 text-left ${
                target ? "bg-indigo-600 hover:bg-indigo-500" : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700"
              }`}
            >
              {event}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={toggleCart}
        className="mt-2 w-full rounded bg-neutral-800 px-2 py-1 text-left hover:bg-neutral-700"
      >
        cartOpen: <span data-testid="cart-open">{String(cartOpen)}</span>
      </button>
      <button
        type="button"
        onClick={() => setPostFx(!postFx)}
        className="mt-1 w-full rounded bg-neutral-800 px-2 py-1 text-left hover:bg-neutral-700"
      >
        postFx: <span data-testid="post-fx">{String(postFx)}</span>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-x-2 text-neutral-400" data-testid="frame-stats">
        <span>{stats ? `${stats.fps.toFixed(0)} fps` : "– fps"}</span>
        <span title="GPU time per frame (timestamp queries)">
          gpu {stats?.gpuMs != null ? stats.gpuMs.toFixed(2) : "–"} ms
        </span>
        <span className={stats && stats.worstMs > 25 ? "text-amber-400" : undefined}>
          worst {stats ? stats.worstMs.toFixed(1) : "–"} ms
        </span>
        <span data-testid="programs">programs {stats?.programs ?? "–"}</span>
      </div>
    </div>
  );
}
