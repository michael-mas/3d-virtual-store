import { MEDIAPIPE_MANIFEST_PATH } from "@/lib/assets";

type WasmEntry = { loader: string; binary: string; loaderSize: number; binarySize: number };
type Manifest = { simd: WasmEntry; nosimd: WasmEntry; model: { path: string; size: number } };

export type TryOnAssets = {
  /** MediaPipe WasmFileset; the binary is a blob: URL of the downloaded bytes (revoke after use). */
  fileset: { wasmLoaderPath: string; wasmBinaryPath: string };
  model: Uint8Array;
};

type ProgressListener = (fraction: number) => void;

const listeners = new Set<ProgressListener>();
let lastFraction = 0;
let pending: Promise<TryOnAssets> | null = null;

/** Subscribe to download progress (0..1) of the current/next try-on asset download. */
export function onTryOnAssetsProgress(listener: ProgressListener): () => void {
  listeners.add(listener);
  listener(lastFraction);
  return () => listeners.delete(listener);
}

function report(fraction: number) {
  lastFraction = fraction;
  for (const l of listeners) l(fraction);
}

/** Streams a response body, reporting bytes as they arrive (sizes come from the manifest, not Content-Length). */
async function download(url: string, onBytes: (n: number) => void): Promise<Uint8Array<ArrayBuffer>> {
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
    onBytes(value.length);
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Downloads the MediaPipe WASM binary (SIMD or not) and the FaceLandmarker model with progress. Shared by the
 * idle prefetch (CUSTOMIZE) and TRY_ON, so a prefetch in progress is simply awaited. Failures reset the cache so
 * a retry downloads again.
 */
export function loadTryOnAssets(): Promise<TryOnAssets> {
  pending ??= (async () => {
    report(0);
    const [manifest, { FilesetResolver }] = await Promise.all([
      fetch(MEDIAPIPE_MANIFEST_PATH).then((r) => {
        if (!r.ok) throw new Error(`manifest: HTTP ${r.status}`);
        return r.json() as Promise<Manifest>;
      }),
      import("@mediapipe/tasks-vision"),
    ]);
    const wasm = (await FilesetResolver.isSimdSupported()) ? manifest.simd : manifest.nosimd;
    const total = wasm.binarySize + manifest.model.size || 1;
    let received = 0;
    const onBytes = (n: number) => report(Math.min((received += n) / total, 1));
    const [binary, model] = await Promise.all([download(wasm.binary, onBytes), download(manifest.model.path, onBytes)]);
    report(1);
    const blob = new Blob([binary], { type: "application/wasm" });
    return { fileset: { wasmLoaderPath: wasm.loader, wasmBinaryPath: URL.createObjectURL(blob) }, model };
  })();
  pending.catch(() => {
    pending = null;
    report(0);
  });
  return pending;
}

/** True when a background prefetch is reasonable (no Data Saver, not a very slow connection). */
export function canPrefetchTryOn(): boolean {
  const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !c?.saveData && !["slow-2g", "2g", "3g"].includes(c?.effectiveType ?? "");
}

/** Frees the downloaded bytes once MediaPipe has consumed them (the landmarker instance is cached). */
export function releaseTryOnAssets() {
  const done = pending;
  pending = null;
  lastFraction = 0;
  void done?.then((a) => URL.revokeObjectURL(a.fileset.wasmBinaryPath)).catch(() => {});
}
