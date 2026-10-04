// Copies runtime WASM assets from node_modules into /public so the app makes
// zero external requests at runtime. Runs automatically on `npm install`.
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  {
    // glTF-specific Draco decoder build (used by DRACOLoader / drei useGLTF).
    from: "node_modules/three/examples/jsm/libs/draco/gltf",
    to: "public/draco",
  },
  {
    // MediaPipe tasks-vision WASM fileset (FilesetResolver.forVisionTasks).
    from: "node_modules/@mediapipe/tasks-vision/wasm",
    to: "public/mediapipe/wasm",
  },
];

for (const { from, to } of targets) {
  const src = join(root, from);
  const dest = join(root, to);
  if (!existsSync(src)) {
    console.error(`[copy-wasm] missing source: ${from}`);
    process.exit(1);
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-wasm] ${from} -> ${to}`);
}

const MODELS = { face: "mediapipe/face_landmarker.task", hand: "mediapipe/hand_landmarker.task" };
for (const model of Object.values(MODELS)) {
  if (!existsSync(join(root, "public", model))) {
    console.warn(`[copy-wasm] public/${model} not found — see README.md (Runtime assets).`);
  }
}

// Byte sizes of the try-on downloads, so the loader can show real progress even when the server compresses
// responses (Content-Length is then the compressed size, or absent).
const size = (rel) => (existsSync(join(root, rel)) ? statSync(join(root, rel)).size : 0);
const wasm = (name) => ({
  loader: `/mediapipe/wasm/${name}.js`,
  binary: `/mediapipe/wasm/${name}.wasm`,
  loaderSize: size(`public/mediapipe/wasm/${name}.js`),
  binarySize: size(`public/mediapipe/wasm/${name}.wasm`),
});
const manifest = {
  simd: wasm("vision_wasm_internal"),
  nosimd: wasm("vision_wasm_nosimd_internal"),
  models: Object.fromEntries(
    Object.entries(MODELS).map(([kind, model]) => [kind, { path: `/${model}`, size: size(`public/${model}`) }]),
  ),
};
writeFileSync(join(root, "public/mediapipe/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("[copy-wasm] wrote public/mediapipe/manifest.json");
