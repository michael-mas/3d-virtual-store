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
 * A souvenir of the visit (the gallery, the performance): the 3D view as it is on screen, in a thin gold frame with
 * the house's name and a caption underneath. Render + drawImage run synchronously in the caller's task (a click).
 */
export function captureSouvenir(caption: string): Promise<Blob> {
  const glCanvas = stage?.querySelector("canvas");
  if (!glCanvas || !renderFrame) return Promise.reject(new Error("The 3D view is not ready"));
  renderFrame();
  const W = glCanvas.width;
  const H = glCanvas.height;
  const pad = Math.round(W * 0.03);
  const band = Math.round(W * 0.07);
  const out = document.createElement("canvas");
  out.width = W + pad * 2;
  out.height = H + pad * 2 + band;
  const ctx = out.getContext("2d");
  if (!ctx) return Promise.reject(new Error("2D canvas unavailable"));
  ctx.fillStyle = "#0b0a09";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(glCanvas, pad, pad, W, H);
  ctx.strokeStyle = "#c8a96a";
  ctx.lineWidth = Math.max(1, W * 0.0015);
  ctx.strokeRect(pad - ctx.lineWidth * 2, pad - ctx.lineWidth * 2, W + ctx.lineWidth * 4, H + ctx.lineWidth * 4);
  ctx.textAlign = "center";
  ctx.fillStyle = "#efe6d6";
  ctx.font = `500 ${Math.round(band * 0.34)}px Georgia, "Times New Roman", serif`;
  ctx.fillText("MAISON PRISMA AURUM", out.width / 2, H + pad + band * 0.55);
  ctx.fillStyle = "#c8a96a";
  ctx.font = `italic ${Math.round(band * 0.22)}px Georgia, serif`;
  ctx.fillText(caption, out.width / 2, H + pad + band * 0.9);
  return new Promise((resolve, reject) => out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png"));
}

/** Saves a blob as a file (an anchor click). */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Composites the try-on view into a PNG that matches the screen: video frame, then the 3D canvas,
 * with the stage's mirroring (when `mirrored`), cropped to the part of the stage visible in the viewport.
 * Render + drawImage happen synchronously in the caller's task; only the PNG encode is async.
 */
export function capturePhoto(mirrored: boolean): Promise<Blob> {
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
  if (mirrored) {
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
