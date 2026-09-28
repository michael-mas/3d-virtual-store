"use client";

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { useEffect, type RefObject } from "react";
import { DEMO_VIDEO_SOURCES } from "@/lib/assets";
import { isDebugEnabled } from "@/lib/debug";
import {
  classifyCameraError,
  FACE_LOST_GRACE_MS,
  STALL_TIMEOUT_MS,
  tryOnError,
  type TryOnErrorKind,
} from "@/lib/tryon/errors";
import { getFaceLandmarker } from "@/lib/tryon/faceLandmarker";
import { PoseSmoother } from "@/lib/tryon/poseSmoother";
import { tracking } from "@/lib/tryon/tracking";
import { useAppStore, type TryOnSource } from "@/store/useAppStore";

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
};

let warnedLayout = false;
/** MediaPipe matrices are column-major; the last row must be [0 0 0 1]. */
function checkLayout(m: number[]) {
  if (process.env.NODE_ENV === "production" || warnedLayout) return;
  if (Math.abs(m[3]) > 1e-4 || Math.abs(m[7]) > 1e-4 || Math.abs(m[11]) > 1e-4 || Math.abs(m[15] - 1) > 1e-4) {
    warnedLayout = true;
    console.warn("[tryOn] facial transformation matrix is not column-major", m);
  }
}

/** Thrown internally to route a failure to a specific error kind. */
class SessionError extends Error {
  constructor(readonly kind: TryOnErrorKind) {
    super(kind);
  }
}

/**
 * Runs a try-on session while `active`: opens the source (webcam via getUserMedia, or the bundled demo video),
 * loads FaceLandmarker, and runs detection on every new video frame (requestVideoFrameCallback). The smoothed
 * pose goes to `tracking`. Every failure ends in an explicit error state (never a blank or frozen stage):
 * permission, missing/busy camera, insecure context, camera unplugged, frozen video, model load failure.
 * Stops all tracks on deactivate/unmount/retry.
 */
export function useTryOnSession(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
  source: TryOnSource,
  attempt: number,
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video) return;

    const { setTryOnStatus, setVideoAspect, setFaceDetected } = useAppStore.getState();
    const smoother = new PoseSmoother();
    let stopped = false;
    let stream: MediaStream | null = null;
    let frameHandle = 0;
    let watchdog = 0;
    let lastTimestamp = -1;
    let lastFrameAt = performance.now();
    let lastFaceAt = -Infinity;

    // Returning to the tab restarts the stall timer (rVFC pauses while hidden).
    const onVisible = () => {
      lastFrameAt = performance.now();
    };

    const stopMedia = () => {
      video.cancelVideoFrameCallback(frameHandle);
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      tracking.hasFace = false;
      setFaceDetected(false);
    };

    const fail = (kind: TryOnErrorKind, detail?: string) => {
      if (stopped) return;
      stopped = true;
      stopMedia();
      setTryOnStatus("error", tryOnError(kind, detail));
    };

    const openCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new SessionError(window.isSecureContext ? "unsupported" : "insecure");
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      } catch (error) {
        throw new SessionError(classifyCameraError(error));
      }
      if (stopped) return stopMedia();
      // Unplugged / revoked camera: the track ends on its own.
      for (const track of stream.getVideoTracks()) track.addEventListener("ended", () => fail("disconnected"));
      video.loop = false;
      video.removeAttribute("src");
      video.srcObject = stream;
    };

    const openDemo = () => {
      const playable = DEMO_VIDEO_SOURCES.find((s) => video.canPlayType(s.type) !== "");
      if (!playable) throw new SessionError("demo");
      video.srcObject = null;
      video.loop = true;
      video.src = playable.src;
    };

    setTryOnStatus("camera");
    (async () => {
      try {
        if (source === "camera") await openCamera();
        else openDemo();
        if (stopped) return;
        try {
          await video.play();
        } catch {
          throw new SessionError(source === "demo" ? "demo" : "in-use");
        }
        if (stopped) return;
        setVideoAspect(video.videoWidth / video.videoHeight);

        setTryOnStatus("model");
        let landmarker: FaceLandmarker;
        try {
          landmarker = await getFaceLandmarker();
        } catch (error) {
          console.error("[tryOn] face landmarker failed to load", error);
          throw new SessionError("model");
        }
        if (stopped) return;
        tracking.video = video;
        // Debug-only handle for inspecting the live pose from the console / e2e checks.
        if (isDebugEnabled()) Object.assign(window, { __tracking: tracking });

        const onFrame: VideoFrameRequestCallback = (now) => {
          if (stopped) return;
          lastFrameAt = performance.now();
          if (now > lastTimestamp) {
            lastTimestamp = now;
            const matrix = landmarker.detectForVideo(video, now).facialTransformationMatrixes[0];
            if (matrix) {
              checkLayout(matrix.data);
              smoother.update(matrix.data, now / 1000, tracking.pose);
              lastFaceAt = now;
            }
            // Brief dropouts keep the last pose; after the grace period the glasses are hidden.
            const present = now - lastFaceAt <= FACE_LOST_GRACE_MS;
            if (!present && tracking.hasFace) smoother.reset();
            tracking.hasFace = present;
            setFaceDetected(present);
          }
          frameHandle = video.requestVideoFrameCallback(onFrame);
        };
        frameHandle = video.requestVideoFrameCallback(onFrame);

        // Frozen camera (no new video frames while the page is visible) → explicit error instead of a stuck
        // image. Progress = a detection callback ran OR the compositor presented new frames (it keeps counting
        // while the main thread is blocked, e.g. by shader compilation). A late tick means the page itself
        // stalled, not the camera, so the timer restarts. The clock starts now, not at session start.
        lastFrameAt = performance.now();
        let presented = video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0;
        let lastTick = performance.now();
        document.addEventListener("visibilitychange", onVisible);
        watchdog = window.setInterval(() => {
          const now = performance.now();
          const late = now - lastTick > 1500;
          lastTick = now;
          const frames = video.getVideoPlaybackQuality?.().totalVideoFrames ?? presented;
          if (frames !== presented || late || document.visibilityState !== "visible") {
            presented = frames;
            lastFrameAt = Math.max(lastFrameAt, now);
            return;
          }
          if (now - lastFrameAt > STALL_TIMEOUT_MS) fail(source === "demo" ? "demo" : "stalled");
        }, 500);

        setTryOnStatus("running");
      } catch (error) {
        if (error instanceof SessionError) fail(error.kind);
        else fail("unknown", error instanceof Error ? error.message : String(error));
      }
    })();

    return () => {
      stopped = true;
      stopMedia();
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
      tracking.video = null;
      // A retry re-runs this effect and immediately moves on to "camera".
      setTryOnStatus("idle");
    };
  }, [videoRef, active, source, attempt]);
}
