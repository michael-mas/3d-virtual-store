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
import { setProductModel } from "@/lib/cart/registry";
import { PEDESTALS, productPosition } from "@/lib/explore/layout";
import { approachPoint } from "@/lib/explore/movement";
import { player, walkTo } from "@/lib/explore/player";
import { getProduct } from "@/lib/products";
import { isTryOnMode } from "@/lib/modes";
import { useAppStore } from "@/store/useAppStore";
import FaceAnchor from "./FaceAnchor";

const isLens = (o: Object3D) =>
  /lens/i.test(o.name) || (o instanceof Mesh && /lens/i.test((o.material as { name?: string }).name ?? ""));

/** Frames during which every material variant is drawn once (invisibly) so its pipeline is compiled up front. */
const WARMUP_FRAMES = 2;

/**
 * One configurable product on its pedestal. Each instance owns a clone of the model and its material set.
 * During try-on the active product's model is re-parented into the FaceAnchor (same objects, no reload).
 */
export default function Glasses({ productId }: { productId: string }) {
  const config = useAppStore((s) => s.configs[productId]);
  const mode = useAppStore((s) => s.mode);
  const active = useAppStore((s) => s.activeProductId === productId);
  const interactWith = useAppStore((s) => s.interactWith);
  const product = getProduct(productId)!;

  const { scene: source } = useGLTF(product.model, DRACO_DECODER_PATH);
  // The loader caches one scene per URL; products sharing a model need their own copy.
  const scene = useMemo(() => source.clone(true), [source]);
  useEffect(() => {
    setProductModel(productId, scene);
    return () => setProductModel(productId, null);
  }, [productId, scene]);
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
    if (mode !== "EXPLORE") return;
    e.stopPropagation();
    // Near the pedestal: interact. Otherwise walk up to it.
    if (useAppStore.getState().nearPedestal === productId) interactWith(productId);
    else {
      const pedestal = PEDESTALS.find((p) => p.productId === productId);
      if (pedestal) walkTo(approachPoint(pedestal, player.position, 0.9));
    }
  };
  const setCursor = (cursor: string) => () => {
    document.body.style.cursor = mode === "EXPLORE" ? cursor : "auto";
  };

  const warmupNode = warming && <primitive object={warmup} />;

  // Same model instance and materials in both placements; only its parent changes.
  const tryOn = isTryOnMode(mode);
  if (tryOn && active) {
    return (
      <FaceAnchor>
        <primitive object={scene} />
        {warmupNode}
      </FaceAnchor>
    );
  }

  // Other products stay mounted (materials kept) but hidden during try-on.
  return (
    <group position={productPosition(productId)} visible={!tryOn}>
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
      {warmupNode}
    </group>
  );
}
