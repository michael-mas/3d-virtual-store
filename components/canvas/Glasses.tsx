"use client";

import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
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

/** Scale used to keep objects drawn (bindings/pipelines kept current) while effectively invisible. */
const TINY = 1e-4;

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
      if (!(o instanceof Mesh)) return;
      (isLens(o) || isLens(o.parent ?? o) ? lenses : frames).push(o);
      // Always drawn, even off-screen: see the keep-alive note below.
      o.frustumCulled = false;
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

  /*
   * Keep-alive: a tiny, never-culled copy of the model with every material variant, drawn every frame.
   * - Pipelines for all variants are compiled up front, so switching options never stalls.
   * - Transmission samples a screen copy that three reallocates on resize (canvas, try-on stage, thumbnails).
   *   In three r186 a material that is not drawn at that moment can keep a binding to the freed texture
   *   (NodeSampledTexture/Bindings generation check), which is a WebGL warning and a WebGPU validation error.
   *   Drawing every variant every frame keeps all bindings current. Cost: a few tiny draws per product.
   */
  const keepAlive = useMemo(() => {
    const group = new Group();
    const add = (meshes: Mesh[], mats: Record<string, Mesh["material"]>) => {
      for (const source of meshes) {
        for (const mat of Object.values(mats)) {
          const m = new Mesh(source.geometry, mat);
          m.frustumCulled = false;
          group.add(m);
        }
      }
    };
    add(frames, frameMats);
    add(lenses, lensMats);
    group.scale.setScalar(TINY);
    return group;
  }, [frames, lenses, frameMats, lensMats]);

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

  const keepAliveNode = <primitive object={keepAlive} />;

  // Same model instance and materials in both placements; only its parent changes.
  const tryOn = isTryOnMode(mode);
  if (tryOn && active) {
    return (
      <FaceAnchor>
        <primitive object={scene} />
        {keepAliveNode}
      </FaceAnchor>
    );
  }

  // Other products stay mounted and drawn during try-on, shrunk to nothing (not `visible=false`, see keep-alive).
  return (
    <group position={productPosition(productId)} scale={tryOn ? TINY : 1}>
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
      {keepAliveNode}
    </group>
  );
}
