import { MEDIAPIPE_MANIFEST_PATH } from "@/lib/assets";

/** The MediaPipe models the try-on can run: one per tracked body part. */
export type TrackerKind = "face" | "hand";

type WasmEntry = { loader: string; binary: string; loaderSize: number; binarySize: number };
type Manifest = { simd: WasmEntry; nosimd: WasmEntry; models: Record<TrackerKind, { path: string; size: number }> };

/** MediaPipe WasmFileset; the binary is a blob: URL of the downloaded bytes, kept for every landmarker created. */
export type WasmFileset = { wasmLoaderPath: string; wasmBinaryPath: string };

type ProgressListener = (fraction: number) => void;

const listeners = new Set<ProgressListener>();
let lastFraction = 0;
/** Bytes expected / received by the downloads in flight; progress spans everything requested together. */
let expected = 0;
let received = 0;
let inFlight = 0;

/** Subscribe to download progress (0..1) of the try-on assets being fetched. */
export function onTryOnAssetsProgress(listener: ProgressListener): () => void {
  listeners.add(listener);
  listener(lastFraction);
  return () => listeners.delete(listener);
}

function report(fraction: number) {
  lastFraction = fraction;
  for (const l of listeners) l(fraction);
}

/**
 * Streams a response body, reporting bytes as they arrive. Sizes come from the manifest, not Content-Length,
 * which is the compressed size (or absent) when the server compresses responses.
 */
async function download(url: string, size: number): Promise<Uint8Array<ArrayBuffer>> {
  inFlight++;
  expected += size;
  report(received / (expected || 1));
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      length += value.length;
      received += value.length;
      report(Math.min(received / (expected || 1), 1));
    }
    const out = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  } finally {
    if (--inFlight === 0) {
      report(1);
      expected = received = 0;
    }
  }
}

/** Caches a promise; a failure clears it so the next call retries. */
function cached<T>(load: () => Promise<T>): { get: () => Promise<T>; clear: () => void } {
  let pending: Promise<T> | null = null;
  return {
    get: () => {
      pending ??= load();
      pending.catch(() => (pending = null));
      return pending;
    },
    clear: () => (pending = null),
  };
}

const manifest = cached(async () => {
  const r = await fetch(MEDIAPIPE_MANIFEST_PATH);
  if (!r.ok) throw new Error(`manifest: HTTP ${r.status}`);
  return (await r.json()) as Manifest;
});

/**
 * The MediaPipe WASM runtime (SIMD build when supported), downloaded once with progress and shared by every
 * landmarker: each task instantiates its own module from the same blob URL, so it is never revoked.
 */
const wasm = cached(async (): Promise<WasmFileset> => {
  const [m, { FilesetResolver }] = await Promise.all([manifest.get(), import("@mediapipe/tasks-vision")]);
  const entry = (await FilesetResolver.isSimdSupported()) ? m.simd : m.nosimd;
  const binary = await download(entry.binary, entry.binarySize);
  return { wasmLoaderPath: entry.loader, wasmBinaryPath: URL.createObjectURL(new Blob([binary], { type: "application/wasm" })) };
});

const models: Record<TrackerKind, ReturnType<typeof cached<Uint8Array>>> = {
  face: cached(async () => {
    const { path, size } = (await manifest.get()).models.face;
    return download(path, size);
  }),
  hand: cached(async () => {
    const { path, size } = (await manifest.get()).models.hand;
    return download(path, size);
  }),
};

export const loadWasmFileset = wasm.get;

/** A tracker's model bytes. Shared by the idle prefetch and TRY_ON, so a prefetch in progress is simply awaited. */
export const loadModel = (kind: TrackerKind) => models[kind].get();

/** Frees a model's bytes once MediaPipe has consumed them (the landmarker instance is cached). */
export const releaseModel = (kind: TrackerKind) => models[kind].clear();

/** Starts downloading what the given trackers need (runtime + models) without initializing anything. */
export function prefetchTryOnAssets(kinds: readonly TrackerKind[]): Promise<unknown> {
  return Promise.all([loadWasmFileset(), ...kinds.map(loadModel)]);
}

/** True when a background prefetch is reasonable (no Data Saver, not a very slow connection). */
export function canPrefetchTryOn(): boolean {
  const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !c?.saveData && !["slow-2g", "2g", "3g"].includes(c?.effectiveType ?? "");
}
