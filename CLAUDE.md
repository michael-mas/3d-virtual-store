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
- Product: glasses only (for now).
- Modes: EXPLORE | CUSTOMIZE | TRY_ON | PHOTO. Cart is an orthogonal drawer (`cartOpen`), not a mode.

## Workflow
- Work on one step at a time. Stop when the step's "Done when" criterion is met and summarize what to test.
- Run `npm run build` and fix all errors before declaring a step done.

## package.json
(to be filled after scaffolding)
