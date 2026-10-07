"use client";

import type { FaceLandmarker, HandLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";
import { useEffect, type RefObject } from "react";
import { DEMO_VIDEO_SOURCES } from "@/lib/assets";
import { wornTrackers } from "@/lib/cart/look";
import type { Tracker } from "@/lib/products";
import { isDebugEnabled } from "@/lib/debug";
import {
  classifyCameraError,
  FACE_LOST_GRACE_MS,
  STALL_TIMEOUT_MS,
  tryOnError,
  type TryOnErrorKind,
} from "@/lib/tryon/errors";
import { onTryOnAssetsProgress } from "@/lib/tryon/assets";
import { MEDIAPIPE_VERTICAL_FOV_DEG } from "@/lib/tryon/constants";
import { measureHair } from "@/lib/tryon/hairFit";
import { HAIR_MASK_HEIGHT, HAIR_MASK_WIDTH, resampleMask } from "@/lib/tryon/hairMask";
import { HAND_LANDMARK_COUNT, handToCamera, type Handedness } from "@/lib/tryon/handPose";
import { getLandmarker } from "@/lib/tryon/landmarkers";
import { OneEuroVector, type OneEuroParams } from "@/lib/tryon/oneEuro";
import { PoseSmoother } from "@/lib/tryon/poseSmoother";
import { blendshapeScore, copyLandmarks, tracking } from "@/lib/tryon/tracking";
import { hairMaskData, hairMaskUpdated } from "@/lib/tryon/videoLayer";
import { useAppStore, type TryOnSource } from "@/store/useAppStore";

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
};

/** Longest side of a photo once drawn into its stream: plenty for tracking, light on the GPU. */
const PHOTO_MAX_SIDE = 1280;

/** Hand landmarks in camera space (meters): smooth when still, follows quick moves. */
const HAND_SMOOTHING: OneEuroParams = { minCutoff: 1.5, beta: 8, dCutoff: 1.0 };
/** Consecutive detections with the other label before the handedness flips. */
const HANDEDNESS_HYSTERESIS = 4;
/** Hair is "in view" when at least this fraction of the frame is segmented as hair. */
const MIN_HAIR_COVERAGE = 0.003;

type Landmarkers = { face?: FaceLandmarker; hand?: HandLandmarker; hair?: ImageSegmenter };

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
 * Runs a try-on session while `active`: opens the source (webcam via getUserMedia, the optional demo video, or a
 * photo turned into a video stream),
 * loads the trackers the worn products need (FaceLandmarker, HandLandmarker), and runs them on every new video
 * frame (requestVideoFrameCallback). Smoothed poses go to `tracking`. A tracker needed later (a look switching
 * to a hand product) is loaded in the background. Every failure ends in an explicit error state (never a blank or frozen stage):
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

    const { setTryOnStatus, setVideoAspect, setFaceDetected, setHandDetected, setHairDetected } = useAppStore.getState();
    const smoother = new PoseSmoother();
    const handSmoother = new OneEuroVector(HAND_LANDMARK_COUNT * 3, HAND_SMOOTHING);
    const handImage = new Float32Array(HAND_LANDMARK_COUNT * 3);
    const handRaw = new Float32Array(HAND_LANDMARK_COUNT * 3);
    const handOut: number[] = [];
    let otherHandedness = 0;
    const landmarkers: Landmarkers = {};
    const loading = new Set<Tracker>();
    /** Loads a tracker's landmarker once; the promise rejects on failure. */
    const load = async (kind: Tracker) => {
      loading.add(kind);
      try {
        if (kind === "face") landmarkers.face = await getLandmarker.face();
        else if (kind === "hand") landmarkers.hand = await getLandmarker.hand();
        else landmarkers.hair = await getLandmarker.hair();
      } finally {
        loading.delete(kind);
      }
    };
    let stopped = false;
    let stream: MediaStream | null = null;
    let photo: ImageBitmap | null = null;
    let photoFrame = 0;
    let frameHandle = 0;
    let watchdog = 0;
    let lastTimestamp = -1;
    let lastFrameAt = performance.now();
    let lastFaceAt = -Infinity;
    let lastHandAt = -Infinity;
    let lastHairAt = -Infinity;
    let detectMs = 0;
    /**
     * Minimum time between detections. Every video frame when the app runs smoothly; capped at 15 Hz / 10 Hz when
     * rendering drops below 30 / 20 fps, and never more often than twice the (smoothed) detection cost, so
     * tracking cannot starve rendering. The One Euro smoother handles the irregular timestamps.
     */
    const detectionInterval = () => {
      const fps = useAppStore.getState().frameStats?.fps ?? 60;
      const cap = fps < 20 ? 100 : fps < 30 ? 66 : 0;
      return Math.max(cap, detectMs * 2);
    };

    // Returning to the tab restarts the stall timer (rVFC pauses while hidden).
    const onVisible = () => {
      lastFrameAt = performance.now();
    };

    const stopMedia = () => {
      video.cancelVideoFrameCallback(frameHandle);
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      cancelAnimationFrame(photoFrame);
      photo?.close();
      photo = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      tracking.hasFace = false;
      tracking.hand.present = false;
      tracking.hair.present = false;
      setFaceDetected(false);
      setHandDetected(false);
      setHairDetected(false);
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

    /**
     * A photo becomes a live stream: drawn on a canvas every animation frame and captured (captureStream), so the
     * whole video pipeline (trackers on each new frame, stage background, capture, stall watchdog) runs unchanged.
     * The image is decoded on the device (orientation from its EXIF) and never leaves it.
     */
    const openPhoto = async () => {
      const image = useAppStore.getState().tryOnImage;
      if (!image) throw new SessionError("photo");
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
      } catch {
        throw new SessionError("photo");
      }
      if (stopped) return bitmap.close();
      photo = bitmap;
      const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round((bitmap.width * scale) / 2) * 2);
      canvas.height = Math.max(2, Math.round((bitmap.height * scale) / 2) * 2);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new SessionError("unsupported");
      const draw = () => {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        photoFrame = requestAnimationFrame(draw);
      };
      draw();
      stream = canvas.captureStream(30);
      video.loop = false;
      video.removeAttribute("src");
      video.srcObject = stream;
    };

    setTryOnStatus("camera");
    (async () => {
      try {
        if (source === "camera") await openCamera();
        else if (source === "photo") await openPhoto();
        else openDemo();
        if (stopped) return;
        try {
          await video.play();
        } catch {
          throw new SessionError(source === "camera" ? "in-use" : source);
        }
        if (stopped) return;
        setVideoAspect(video.videoWidth / video.videoHeight);

        setTryOnStatus("model");
        const unsubscribe = onTryOnAssetsProgress((f) => useAppStore.getState().setTryOnProgress(f));
        try {
          await Promise.all([...wornTrackers(useAppStore.getState())].map(load));
        } catch (error) {
          console.error("[tryOn] landmarker failed to load", error);
          throw new SessionError("model");
        } finally {
          unsubscribe();
          useAppStore.getState().setTryOnProgress(null);
        }
        if (stopped) return;
        tracking.video = video;
        // Debug-only handle for inspecting the live pose from the console / e2e checks.
        if (isDebugEnabled()) Object.assign(window, { __tracking: tracking });

        const detectFace = (landmarker: FaceLandmarker, now: number) => {
          const result = landmarker.detectForVideo(video, now);
          const matrix = result.facialTransformationMatrixes[0];
          const landmarks = result.faceLandmarks[0];
          if (!matrix || !landmarks) return;
          checkLayout(matrix.data);
          smoother.update(matrix.data, now / 1000, tracking.pose);
          copyLandmarks(landmarks, tracking.landmarks);
          tracking.landmarksVersion++;
          const shapes = result.faceBlendshapes[0]?.categories;
          tracking.jawOpen = shapes ? blendshapeScore(shapes, "jawOpen") : 0;
          lastFaceAt = now;
        };

        const detectHand = (landmarker: HandLandmarker, now: number) => {
          const result = landmarker.detectForVideo(video, now);
          const landmarks = result.landmarks[0];
          if (!landmarks) return;
          copyLandmarks(landmarks, handImage);
          const aspect = video.videoWidth / video.videoHeight;
          if (!handToCamera(handImage, aspect, MEDIAPIPE_VERTICAL_FOV_DEG, handRaw)) return;
          handSmoother.filter(handRaw, now / 1000, handOut);
          tracking.hand.points.set(handOut);
          const label = result.handedness[0]?.[0]?.categoryName as Handedness | undefined;
          if (label && label !== tracking.hand.handedness) {
            // A newly appearing hand takes its label at once; a tracked one needs it confirmed.
            if (!tracking.hand.present || ++otherHandedness >= HANDEDNESS_HYSTERESIS) {
              tracking.hand.handedness = label;
              otherHandedness = 0;
            }
          } else otherHandedness = 0;
          lastHandAt = now;
        };

        const segmentHair = (segmenter: ImageSegmenter, now: number) => {
          const result = segmenter.segmentForVideo(video, now);
          try {
            // Hair model categories: [background, hair].
            const mask = result.confidenceMasks?.[1];
            if (!mask) return;
            const coverage = resampleMask(mask.getAsFloat32Array(), mask.width, mask.height, hairMaskData);
            hairMaskUpdated();
            if (coverage >= MIN_HAIR_COVERAGE) lastHairAt = now;
            // How far the hair extends around the face (hats are sized to it), smoothed over ~0.3 s.
            if (now - lastFaceAt <= FACE_LOST_GRACE_MS) {
              const extent = measureHair(hairMaskData, HAIR_MASK_WIDTH, HAIR_MASK_HEIGHT, tracking.landmarks, video.videoWidth / video.videoHeight);
              if (extent) {
                tracking.hair.above += (extent.above - tracking.hair.above) * 0.25;
                tracking.hair.width += (extent.width - tracking.hair.width) * 0.25;
              }
            }
          } finally {
            result.close();
          }
        };

        const onFrame: VideoFrameRequestCallback = (now) => {
          if (stopped) return;
          lastFrameAt = performance.now();
          if (now > lastTimestamp && now - lastTimestamp >= detectionInterval()) {
            lastTimestamp = now;
            const needed = wornTrackers(useAppStore.getState());
            for (const kind of needed) {
              if (!landmarkers[kind] && !loading.has(kind)) load(kind).catch(() => fail("model"));
            }
            const t0 = performance.now();
            if (needed.has("face") && landmarkers.face) detectFace(landmarkers.face, now);
            if (needed.has("hand") && landmarkers.hand) detectHand(landmarkers.hand, now);
            if (needed.has("hair") && landmarkers.hair) segmentHair(landmarkers.hair, now);
            detectMs = detectMs * 0.8 + (performance.now() - t0) * 0.2;

            // Brief dropouts keep the last pose; after the grace period the product is hidden.
            const face = needed.has("face") && now - lastFaceAt <= FACE_LOST_GRACE_MS;
            if (!face && tracking.hasFace) smoother.reset();
            tracking.hasFace = face;
            setFaceDetected(face);
            const hand = needed.has("hand") && now - lastHandAt <= FACE_LOST_GRACE_MS;
            if (!hand && tracking.hand.present) handSmoother.reset();
            tracking.hand.present = hand;
            setHandDetected(hand);
            const hair = needed.has("hair") && now - lastHairAt <= FACE_LOST_GRACE_MS;
            tracking.hair.present = hair;
            setHairDetected(hair);
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
          if (now - lastFrameAt > STALL_TIMEOUT_MS) fail(source === "camera" ? "stalled" : source);
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
