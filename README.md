# 3d-virtual-store

3D virtual store & virtual try-on proof of concept (glasses). Next.js App Router,
static export, 100% client-side.

## Getting started

```bash
npm install      # also runs scripts/copy-wasm.mjs (postinstall)
npm run dev      # http://localhost:3000
npm run build    # static export to ./out
npm start        # serve ./out locally
```

## Local runtime assets

The app makes zero external requests at runtime. All binary assets are served from `/public`:

| Path | Source | How it gets there |
| --- | --- | --- |
| `public/draco/` | `three/examples/jsm/libs/draco/gltf` | `postinstall` (gitignored) |
| `public/mediapipe/wasm/` | `@mediapipe/tasks-vision/wasm` | `postinstall` (gitignored) |
| `public/mediapipe/face_landmarker.task` | Google MediaPipe model | manual download (committed) |
| `public/models/` | glTF/GLB product models | committed |

Paths are exported from `lib/assets.ts`.

### Try-on model: `face_landmarker.task`

Download the Face Landmarker model (float16) and place it at `public/mediapipe/face_landmarker.task`:

```bash
curl -L -o public/mediapipe/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
```

Model card and other variants:
https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models

Commit the file so the Vercel build includes it (it is not fetched at build or run time).
