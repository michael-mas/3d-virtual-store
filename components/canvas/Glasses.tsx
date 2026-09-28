"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box3, Group, Mesh, Vector3, type Object3D } from "three/webgpu";
import { DRACO_DECODER_PATH } from "@/lib/assets";
import {
  createFrameMaterials,
  createLensMaterials,
  disposeMaterials,
  setFrameColor,
} from "@/lib/materials";
import { getProduct } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

const isLens = (o: Object3D) =>
  /lens/i.test(o.name) || (o instanceof Mesh && /lens/i.test((o.material as { name?: string }).name ?? ""));

/** Frames during which every material variant is drawn once (invisibly) so its pipeline is compiled up front. */
const WARMUP_FRAMES = 2;

export default function Glasses() {
  const productId = useAppStore((s) => s.activeProductId);
  const config = useAppStore((s) => s.configs[s.activeProductId]);
  const mode = useAppStore((s) => s.mode);
  const transition = useAppStore((s) => s.transition);
  const product = getProduct(productId)!;

  const { scene } = useGLTF(product.model, DRACO_DECODER_PATH);
  const frameMats = useMemo(() => createFrameMaterials(), []);
  const lensMats = useMemo(() => createLensMaterials(), []);
  useEffect(
    () => () => {
      disposeMaterials(frameMats);
      disposeMaterials(lensMats);
    },
    [frameMats, lensMats],
  );

  const { frames, lenses } = useMemo(() => {
    const frames: Mesh[] = [];
    const lenses: Mesh[] = [];
    scene.traverse((o) => {
      if (o instanceof Mesh) (isLens(o) || isLens(o.parent ?? o) ? lenses : frames).push(o);
    });
    return { frames, lenses };
  }, [scene]);

  // Live config -> materials. Only swaps references / sets uniforms; no shader rebuilds.
  useEffect(() => {
    for (const m of frames) m.material = frameMats[config.finish];
  }, [frames, frameMats, config.finish]);
  useEffect(() => setFrameColor(frameMats, config.frameColor), [frameMats, config.frameColor]);
  useEffect(() => {
    for (const m of lenses) m.material = lensMats[config.lens];
  }, [lenses, lensMats, config.lens]);

  // Pre-compile every variant: tiny copies with each material, rendered for a couple of frames.
  const warmup = useMemo(() => {
    const group = new Group();
    const add = (meshes: Mesh[], mats: Record<string, Mesh["material"]>) => {
      if (!meshes[0]) return;
      for (const mat of Object.values(mats)) group.add(new Mesh(meshes[0].geometry, mat));
    };
    add(frames, frameMats);
    add(lenses, lensMats);
    group.scale.setScalar(1e-4);
    return group;
  }, [frames, lenses, frameMats, lensMats]);
  const [warming, setWarming] = useState(true);
  const warmFrames = useRef(0);
  useFrame(() => {
    if (warming && ++warmFrames.current > WARMUP_FRAMES) setWarming(false);
  });

  // Invisible bounding-box hit target: thin frame wires are hard to click.
  const hitBox = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    return { size: box.getSize(new Vector3()).toArray(), center: box.getCenter(new Vector3()).toArray() };
  }, [scene]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (mode === "EXPLORE") transition("INTERACT");
  };
  const setCursor = (cursor: string) => () => {
    document.body.style.cursor = mode === "EXPLORE" ? cursor : "auto";
  };

  return (
    <group>
      <primitive object={scene} />
      <mesh
        visible={false}
        position={hitBox.center}
        onClick={onClick}
        onPointerOver={setCursor("pointer")}
        onPointerOut={setCursor("auto")}
      >
        <boxGeometry args={hitBox.size} />
      </mesh>
      {warming && <primitive object={warmup} />}
    </group>
  );
}
