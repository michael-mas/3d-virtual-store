"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { reflector } from "three/tsl";
import { AdditiveBlending, DoubleSide, Mesh, MeshBasicNodeMaterial, PlaneGeometry, type Camera } from "three/webgpu";
import { DRACO_DECODER_PATH, SHOWROOM_MODEL_PATH } from "@/lib/assets";
import { DOOR_CENTER, FLOOR_Y, GALLERY, ROOM, WALK_BOUNDS } from "@/lib/explore/layout";
import { walkTo } from "@/lib/explore/player";
import { NO_REFLECTION_LAYER } from "@/lib/layers";
import { isTryOnMode } from "@/lib/modes";
import { useAppStore } from "@/store/useAppStore";

/** Pointer travel (px) above which a click is treated as a camera drag, not a move command. */
const DRAG_THRESHOLD = 6;

/** How much of the mirrored scene the polished marble floor shows. */
const FLOOR_REFLECTION = 0.3;

/**
 * Low-poly showroom with lighting baked into vertex colors (unlit material: no lights, no shadow maps), a
 * polished-marble reflection on the floor (TSL reflector at half resolution, added over the baked floor), plus an
 * invisible ground plane for click-to-move over the salon and the gallery (the entrance wall between them catches
 * clicks, so a click on it does not walk through to the floor behind). Hidden during try-on (the reflection then
 * costs nothing).
 */
export default function Showroom() {
  const hidden = useAppStore((s) => isTryOnMode(s.mode));
  // The floor reflection is an effect too: off with them (low-end fallback, render failures).
  const postFx = useAppStore((s) => s.postFx);
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
    return { mesh, reflection };
  }, []);

  // The reflection's camera is a clone of the view camera, made on first use: take the transmissive layer off it
  // (glass at half resolution would free the screen copy the main pass samples; see lib/layers.ts).
  useFrame(({ camera }) => {
    const { reflector } = mirror.reflection as unknown as { reflector: { getVirtualCamera(camera: Camera): Camera } };
    reflector.getVirtualCamera(camera).layers.disable(NO_REFLECTION_LAYER);
  });

  useEffect(
    () => () => {
      mirror.mesh.geometry.dispose();
      (mirror.mesh.material as MeshBasicNodeMaterial).dispose();
    },
    [mirror],
  );

  const onGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (useAppStore.getState().mode !== "EXPLORE" || e.delta > DRAG_THRESHOLD) return;
    e.stopPropagation();
    walkTo([e.point.x, e.point.z]);
  };

  const stopClick = (e: ThreeEvent<MouseEvent>) => e.stopPropagation();
  const W = WALK_BOUNDS.maxX - WALK_BOUNDS.minX;
  const D = WALK_BOUNDS.maxZ - WALK_BOUNDS.minZ;
  const opening = GALLERY.door.halfWidth;
  const wallSide = ROOM.halfWidth - opening;

  return (
    <group visible={!hidden}>
      <primitive object={room} />
      {postFx && <primitive object={mirror.mesh} />}
      <mesh
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(WALK_BOUNDS.minX + WALK_BOUNDS.maxX) / 2, FLOOR_Y, (WALK_BOUNDS.minZ + WALK_BOUNDS.maxZ) / 2]}
        onClick={onGroundClick}
      >
        <planeGeometry args={[W, D]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} visible={false} position={[side * (opening + wallSide / 2), FLOOR_Y + GALLERY.height / 2, DOOR_CENTER[1]]} onClick={stopClick}>
          <planeGeometry args={[wallSide, GALLERY.height]} />
          <meshBasicMaterial side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
