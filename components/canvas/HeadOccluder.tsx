"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Mesh, MeshBasicNodeMaterial } from "three/webgpu";
import { DRACO_DECODER_PATH, HEAD_OCCLUDER_MODEL_PATH } from "@/lib/assets";

/**
 * Invisible head (canonical face mesh + back-of-head volume) that only writes depth.
 * renderOrder -1 draws it before the glasses, so temples behind the head fail the depth test.
 */
export default function HeadOccluder() {
  const { scene } = useGLTF(HEAD_OCCLUDER_MODEL_PATH, DRACO_DECODER_PATH);

  const occluder = useMemo(() => {
    const material = new MeshBasicNodeMaterial({ name: "head-occluder", colorWrite: false });
    const root = scene.clone();
    root.traverse((o) => {
      if (o instanceof Mesh) {
        o.material = material;
        o.renderOrder = -1;
      }
    });
    return root;
  }, [scene]);

  return <primitive object={occluder} />;
}

useGLTF.preload(HEAD_OCCLUDER_MODEL_PATH, DRACO_DECODER_PATH);
