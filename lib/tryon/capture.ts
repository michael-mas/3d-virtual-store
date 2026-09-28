import { TRY_ON_MIRRORED } from "./constants";
import { tracking } from "./tracking";

/**
 * Registered by the R3F scene: renders one frame synchronously (same path as the frame loop).
 * The WebGL drawing buffer (preserveDrawingBuffer: false) and the WebGPU canvas texture are only
 * readable in the task that rendered them, so capture renders right before reading.
 */
let renderFrame: (() => void) | null = null;
let stage: HTMLElement | null = null;

export function setCaptureRenderer(fn: (() => void) | null) {
  renderFrame = fn;
}

export function setCaptureStage(el: HTMLElement | null) {
  stage = el;
}

/**
 * Composites the try-on view into a PNG that matches the screen: video frame, then the 3D canvas,
 * with the stage's mirroring, cropped to the part of the stage visible in the viewport.
 * Render + drawImage happen synchronously in the caller's task; only the PNG encode is async.
 */
export function capturePhoto(): Promise<Blob> {
  const glCanvas = stage?.querySelector("canvas");
  const video = tracking.video;
  if (!stage || !glCanvas || !video || !renderFrame) {
    return Promise.reject(new Error("Try-on stage is not ready"));
  }

  renderFrame();

  // Output in device pixels of the on-screen box, so the PNG matches what the browser composites.
  const rect = stage.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const W = rect.width * scale;
  const H = rect.height * scale;
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, window.innerWidth);
  const bottom = Math.min(rect.bottom, window.innerHeight);

  const out = document.createElement("canvas");
  out.width = Math.round((right - left) * scale);
  out.height = Math.round((bottom - top) * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return Promise.reject(new Error("2D canvas unavailable"));

  // Screen-space crop, then the stage's own transform (mirror about its vertical axis).
  ctx.translate(-(left - rect.left) * scale, -(top - rect.top) * scale);
  if (TRY_ON_MIRRORED) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  // The stage has the video's aspect ratio, so both layers map to the same full-stage rectangle.
  ctx.drawImage(video, 0, 0, W, H);
  ctx.drawImage(glCanvas, 0, 0, W, H);

  return new Promise((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png"),
  );
}
