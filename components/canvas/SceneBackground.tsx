"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Color, SRGBColorSpace, VideoTexture } from "three/webgpu";
import { isTryOnMode } from "@/lib/modes";
import { tracking } from "@/lib/tryon/tracking";
import { setVideoTexture, videoWithSurface } from "@/lib/tryon/videoLayer";
import { useAppStore } from "@/store/useAppStore";

const STORE_BACKGROUND = new Color("#0b0a09");

/**
 * Store backdrop color, or the webcam feed during try-on. The video is part of the rendered frame so
 * transmissive lenses refract the face and a photo is a single canvas capture. In try-on the background node
 * also composites the surface layer (makeup, face paint) over the video, under the rigid products.
 */
export default function SceneBackground() {
  const scene = useThree((s) => s.scene);
  const running = useAppStore((s) => isTryOnMode(s.mode) && s.tryOnStatus === "running");

  useEffect(() => {
    const video = tracking.video;
    if (!running || !video) {
      scene.background = STORE_BACKGROUND;
      return;
    }
    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    scene.background = texture;
    setVideoTexture(texture);
    scene.backgroundNode = videoWithSurface;
    return () => {
      scene.backgroundNode = null;
      scene.background = STORE_BACKGROUND;
      setVideoTexture(null);
      texture.dispose();
    };
  }, [scene, running]);

  return null;
}
