"use client";

import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { reflector } from "three/tsl";
import { AdditiveBlending, Mesh, MeshBasicNodeMaterial, PlaneGeometry } from "three/webgpu";
import { DRACO_DECODER_PATH, SHOWROOM_MODEL_PATH } from "@/lib/assets";
import { FLOOR_Y, ROOM } from "@/lib/explore/layout";
import { walkTo } from "@/lib/explore/player";
import { isTryOnMode } from "@/lib/modes";
import { useAppStore } from "@/store/useAppStore";

/** Pointer travel (px) above which a click is treated as a camera drag, not a move command. */
const DRAG_THRESHOLD = 6;

/** How much of the mirrored scene the polished marble floor shows. */
const FLOOR_REFLECTION = 0.3;

/**
 * Low-poly showroom with lighting baked into vertex colors (unlit material: no lights, no shadow maps), a
 * polished-marble reflection on the floor (TSL reflector at half resolution, added over the baked floor), plus an
 * invisible ground plane for click-to-move. Hidden during try-on (the reflection then costs nothing).
 */
export default function Showroom() {
  const hidden = useAppStore((s) => isTryOnMode(s.mode));
  const { scene } = useGLTF(SHOWROOM_MODEL_PATH, DRACO_DECODER_PATH);

  const room = useMemo(() => {
    const material = new MeshBasicNodeMaterial({ name: "showroom-baked", vertexColors: true });
    scene.traverse((o) => {
      if (o instanceof Mesh) o.material = material;
    });
    return scene;
  }, [scene]);

  const mirror = useMemo(() => {
    const reflection = reflector({ resolutionScale: 0.5, bounces: false });
    reflection.target.rotateX(-Math.PI / 2);
    const material = new MeshBasicNodeMaterial({ name: "floor-reflection", transparent: true, depthWrite: false, blending: AdditiveBlending });
    material.colorNode = reflection.rgb.mul(FLOOR_REFLECTION);
    const mesh = new Mesh(new PlaneGeometry(ROOM.halfWidth * 2, ROOM.halfDepth * 2), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = FLOOR_Y + 0.001;
    mesh.add(reflection.target);
    mesh.raycast = () => {};
    return mesh;
  }, []);

  useEffect(
    () => () => {
      mirror.geometry.dispose();
      (mirror.material as MeshBasicNodeMaterial).dispose();
    },
    [mirror],
  );

  const onGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (useAppStore.getState().mode !== "EXPLORE" || e.delta > DRAG_THRESHOLD) return;
    e.stopPropagation();
    walkTo([e.point.x, e.point.z]);
  };

  return (
    <group visible={!hidden}>
      <primitive object={room} />
      <primitive object={mirror} />
      <mesh visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} onClick={onGroundClick}>
        <planeGeometry args={[ROOM.halfWidth * 2, ROOM.halfDepth * 2]} />
      </mesh>
    </group>
  );
}
