"use client";

import dynamic from "next/dynamic";
import { useRef, type CSSProperties } from "react";
import { useTryOnSession } from "@/hooks/useTryOnSession";
import { isTryOnMode } from "@/lib/modes";
import { setCaptureStage } from "@/lib/tryon/capture";
import { TRY_ON_MIRRORED } from "@/lib/tryon/constants";
import { useAppStore } from "@/store/useAppStore";
import RendererErrorBoundary from "./RendererErrorBoundary";

// Client-only: WebGPU/WebGL cannot run during static prerendering.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

const FALLBACK_ASPECT = 4 / 3;

/**
 * The stage: the single persistent Canvas (mounted once in the root layout) plus the webcam <video>.
 * In try-on the stage takes the video's aspect ratio (so the 63° MediaPipe camera matches the frame),
 * covers the viewport, and is mirrored with one CSS transform that applies to video and 3D alike.
 */
export default function SceneCanvas() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tryOn = useAppStore((s) => isTryOnMode(s.mode));
  const aspect = useAppStore((s) => s.videoAspect) ?? FALLBACK_ASPECT;
  const source = useAppStore((s) => s.tryOnSource);
  const attempt = useAppStore((s) => s.tryOnAttempt);

  useTryOnSession(videoRef, tryOn, source, attempt);

  const style: CSSProperties = tryOn
    ? {
        position: "fixed",
        left: "50%",
        top: "50%",
        width: `max(100vw, calc(100vh * ${aspect}))`,
        aspectRatio: aspect,
        transform: `translate(-50%, -50%)${TRY_ON_MIRRORED ? " scaleX(-1)" : ""}`,
      }
    : { position: "fixed", inset: 0 };

  return (
    <div ref={setCaptureStage} style={style} data-testid="stage">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`absolute inset-0 h-full w-full object-cover ${tryOn ? "" : "hidden"}`}
      />
      <div className="absolute inset-0">
        <RendererErrorBoundary>
          <Scene />
        </RendererErrorBoundary>
      </div>
    </div>
  );
}
