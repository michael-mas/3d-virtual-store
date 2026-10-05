"use client";

import dynamic from "next/dynamic";
import { useRef, type CSSProperties } from "react";
import { useTryOnSession } from "@/hooks/useTryOnSession";
import { isTryOnMode } from "@/lib/modes";
import { installNetworkGuard } from "@/lib/networkGuard";
import { setCaptureStage } from "@/lib/tryon/capture";
import { isTryOnMirrored } from "@/lib/tryon/constants";
import { useAppStore } from "@/store/useAppStore";
import RendererErrorBoundary from "./RendererErrorBoundary";

// No request may leave the device (see lib/networkGuard.ts); installed before anything else runs client-side.
installNetworkGuard();

// Client-only: WebGPU/WebGL cannot run during static prerendering. The chunk download starts as soon as this
// module is evaluated on the client, not after hydration.
const loadScene = () => import("./Scene");
if (typeof window !== "undefined") void loadScene();
const Scene = dynamic(loadScene, { ssr: false });

const FALLBACK_ASPECT = 4 / 3;

/**
 * The stage: the single persistent Canvas (mounted once in the root layout) plus the webcam <video>.
 * In try-on the stage takes the video's aspect ratio (so the 63° MediaPipe camera matches the frame),
 * covers the viewport (an uploaded photo fits inside it instead), and is mirrored like a selfie (not a photo) with
 * one CSS transform that applies to video and 3D alike.
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
        // dvh: the visible viewport on mobile (100vh would include the collapsed address bar). Live video covers
        // the viewport; an uploaded photo is shown whole (often portrait on a landscape screen).
        width: `${source === "photo" ? "min" : "max"}(100vw, calc(100dvh * ${aspect}))`,
        aspectRatio: aspect,
        transform: `translate(-50%, -50%)${isTryOnMirrored(source) ? " scaleX(-1)" : ""}`,
      }
    : { position: "fixed", inset: 0 };
  // The 3D view owns its gestures (drag to look, tap to walk, pinch in CUSTOMIZE): no browser pan/zoom on it.
  style.touchAction = "none";

  return (
    <div
      ref={setCaptureStage}
      style={style}
      data-testid="stage"
      role="region"
      aria-roledescription="3D view"
      aria-label="3D store"
      aria-describedby="stage-help"
    >
      <p id="stage-help" className="sr-only">
        Interactive 3D showroom. Walk with W A S D, Z Q S D or the arrow keys; press E near a pedestal to open a
        product. All actions are also available from the on-screen controls.
      </p>
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
