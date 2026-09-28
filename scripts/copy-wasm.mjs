// Copies runtime WASM assets from node_modules into /public so the app makes
// zero external requests at runtime. Runs automatically on `npm install`.
import { cpSync, existsSync, mkdirSync } from "node:fs";
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

if (!existsSync(join(root, "public/mediapipe/face_landmarker.task"))) {
  console.warn(
    "[copy-wasm] public/mediapipe/face_landmarker.task not found — see README.md (Try-on model).",
  );
}
