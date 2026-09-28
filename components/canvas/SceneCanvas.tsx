"use client";

import dynamic from "next/dynamic";

// Client-only: WebGPU/WebGL cannot run during static prerendering.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

/** The single persistent Canvas, mounted once in the root layout. */
export default function SceneCanvas() {
  return (
    <div className="fixed inset-0">
      <Scene />
    </div>
  );
}
