"use client";

import { useEffect, type RefObject } from "react";
import { isDebugEnabled } from "@/lib/debug";
import { getFaceLandmarker } from "@/lib/tryon/faceLandmarker";
import { PoseSmoother } from "@/lib/tryon/poseSmoother";
import { tracking } from "@/lib/tryon/tracking";
import { useAppStore } from "@/store/useAppStore";

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

/**
 * Runs the webcam + FaceLandmarker while `active`: getUserMedia → <video>, detection on every new video frame
 * (requestVideoFrameCallback), smoothed pose written to `tracking`. Stops all tracks on deactivate/unmount.
 */
export function useTryOnSession(videoRef: RefObject<HTMLVideoElement | null>, active: boolean) {
  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video) return;

    const { setTryOnStatus, setVideoAspect, setFaceDetected } = useAppStore.getState();
    const smoother = new PoseSmoother();
    let stopped = false;
    let stream: MediaStream | null = null;
    let frameHandle = 0;
    let lastTimestamp = -1;

    const stopTracks = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    setTryOnStatus("starting");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
        if (stopped) return stopTracks();
        video.srcObject = stream;
        await video.play();
        setVideoAspect(video.videoWidth / video.videoHeight);

        const landmarker = await getFaceLandmarker();
        if (stopped) return;
        tracking.video = video;
        // Debug-only handle for inspecting the live pose from the console / e2e checks.
        if (isDebugEnabled()) Object.assign(window, { __tracking: tracking });

        const onFrame: VideoFrameRequestCallback = (now) => {
          if (stopped) return;
          if (now > lastTimestamp) {
            lastTimestamp = now;
            const matrix = landmarker.detectForVideo(video, now).facialTransformationMatrixes[0];
            if (matrix) {
              checkLayout(matrix.data);
              smoother.update(matrix.data, now / 1000, tracking.pose);
            } else {
              smoother.reset();
            }
            if (tracking.hasFace !== !!matrix) {
              tracking.hasFace = !!matrix;
              setFaceDetected(!!matrix);
            }
          }
          frameHandle = video.requestVideoFrameCallback(onFrame);
        };
        frameHandle = video.requestVideoFrameCallback(onFrame);
        setTryOnStatus("running");
      } catch (error) {
        stopTracks();
        if (stopped) return;
        const message =
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Camera access was denied."
            : error instanceof Error
              ? error.message
              : String(error);
        setTryOnStatus("error", message);
      }
    })();

    return () => {
      stopped = true;
      video.cancelVideoFrameCallback(frameHandle);
      stopTracks();
      video.srcObject = null;
      tracking.video = null;
      tracking.hasFace = false;
      setFaceDetected(false);
      setTryOnStatus("idle");
    };
  }, [videoRef, active]);
}
