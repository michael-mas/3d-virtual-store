# Project: 3D Virtual Store & Try-On PoC (portfolio)

## Constraints
- Next.js App Router, TypeScript strict, `output: 'export'`, deployed on Vercel free tier.
- 100% client-side. All 3D/AR code is client-only (`'use client'` + `next/dynamic` with `ssr: false`).
- Zero external runtime requests: Draco decoder, MediaPipe WASM and `face_landmarker.task` are served from `/public`.
- Before using any three/R3F/drei/MediaPipe API, verify its signature in node_modules — do not rely on memory.

## Rendering rules
- Renderer: `WebGPURenderer` from `three/webgpu`. It falls back to its own WebGL2 backend; no separate fallback code.
- No GLSL `ShaderMaterial`, no `@react-three/postprocessing`. Materials and post-processing use TSL only.
- Check every drei component for WebGPU compatibility before using it (Html, CameraControls, useGLTF are OK;
  MeshTransmissionMaterial, ContactShadows are not).
- A single persistent `<Canvas>` for the whole app; modes swap scene content, never remount the Canvas.

## Scope
- Products come from the registry in `lib/products` (not glasses only): each entry defines id, name, category,
  attachment type (`rigid` | `surface` | `landmark`), a customization schema (options, allowed values, price
  modifiers), try-on calibration, and its scene renderer. The customizer UI and cart pricing are generated from
  the schema — never hardcode product options. Adding a product = a registry entry + its assets (and a pedestal
  slot in `lib/explore/showroom-layout.json`, placed in registry order).
- Modes: EXPLORE | CUSTOMIZE | TRY_ON | PHOTO. Cart is an orthogonal drawer (`cartOpen`), not a mode.

## Workflow
- Work on one step at a time. Stop when the step's "Done when" criterion is met and summarize what to test.
- Run `npm run build` and fix all errors before declaring a step done.

## package.json
Exact installed versions (pinned, no ranges). Read `node_modules/next/dist/docs/` for Next.js APIs.

Dependencies:
- `next` 16.3.6
- `react` 19.2.8, `react-dom` 19.2.8
- `three` 0.186.1
- `@react-three/fiber` 9.8.1
- `@react-three/drei` 10.7.9
- `@mediapipe/tasks-vision` 1.0.1
- `zustand` 5.0.15

Dev dependencies:
- `typescript` 5.9.3
- `tailwindcss` 4.3.3, `@tailwindcss/postcss` 4.3.3
- `eslint` 9.39.5, `eslint-config-next` 16.3.6
- `vitest` 5.0.2 (config: `vitest.config.mts`, tests are `**/*.test.ts`)
- `@gltf-transform/core` 4.5.0, `@gltf-transform/extensions` 4.5.0, `@gltf-transform/functions` 4.5.0, `draco3dgltf` 1.5.7 (model generation only)
- `@types/three` 0.186.0, `@types/react` 19.2.18, `@types/react-dom` 19.2.7, `@types/node` 22.20.4

Scripts: `dev`, `build` (static export to `out/`), `start` (serve `out/`), `lint`, `test`, `test:watch`,
`generate:models` (Draco `public/models/glasses.glb`, `head-occluder.glb` from `scripts/data/canonical_face_model.obj`,
`showroom.glb` with baked vertex-color lighting from `lib/explore/showroom-layout.json`),
`postinstall` (`scripts/copy-wasm.mjs` copies Draco → `public/draco/`, MediaPipe WASM → `public/mediapipe/wasm/`).
Asset paths live in `lib/assets.ts`.
