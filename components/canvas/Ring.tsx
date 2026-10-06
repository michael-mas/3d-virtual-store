"use client";

import { useEffect, useMemo } from "react";
import { abs, dot, float, normalView, positionViewDirection, pow, sin, time, uniform, vec3 } from "three/tsl";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalNodeMaterial,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
} from "three/webgpu";
import { setProductModel } from "@/lib/cart/registry";
import { wornProductIds } from "@/lib/cart/look";
import { isTryOnMode } from "@/lib/modes";
import { readRingConfig, type RingMetal, type RingStone } from "@/lib/products/ring";
import type { Finger } from "@/lib/tryon/handPose";
import { useAppStore } from "@/store/useAppStore";
import { depthOnlyMaterial, restOnPedestal } from "./displayHelpers";
import HandAnchor from "./HandAnchor";
import PedestalMount from "./PedestalMount";

// Model space (meters, for a NOMINAL_PALM_WIDTH_M hand): Y along the finger, Z out of the back of the finger
// (stone), X = Y × Z (lib/tryon/handPose.ts fingerPose). The band is a torus around Y.
const TUBE = 0.00115;
/** Finger radius at the ring's position, for the nominal hand. */
const FINGER_RADIUS: Record<Finger, number> = { index: 0.0098, middle: 0.0101, ring: 0.0093, pinky: 0.0082 };
const DISPLAY_SCALE = 2.4;
/** On the pedestal: standing in its box, ring facing the viewer (model Y → world −Z), stone up. */
const DISPLAY_ROTATION = [-Math.PI / 2, 0, 0] as const;

const METAL_LOOK: Record<RingMetal, { color: string; roughness: number }> = {
  "yellow-gold": { color: "#d4af37", roughness: 0.18 },
  "white-gold": { color: "#e3e4e6", roughness: 0.18 },
  "rose-gold": { color: "#e0a899", roughness: 0.2 },
  platinum: { color: "#d9dadc", roughness: 0.12 },
};
const STONE_COLOR: Record<Exclude<RingStone, "none">, string> = {
  diamond: "#eef6ff",
  ruby: "#c1121f",
  emerald: "#1f9d63",
  sapphire: "#1d4ed8",
};

/** Round brilliant: pavilion point, girdle, crown and table, with 8 facets around (flat shaded). */
function brilliantGeometry(): BufferGeometry {
  const profile = [
    [0, -0.0021],
    [0.0031, 0],
    [0.0031, 0.0002],
    [0.0019, 0.0011],
    [0, 0.0011],
  ].map(([r, h]) => new Vector2(r, h));
  const lathe = new LatheGeometry(profile, 8).toNonIndexed();
  lathe.computeVertexNormals();
  lathe.rotateX(Math.PI / 2); // axis Y → Z (out of the back of the finger)
  return lathe;
}

/**
 * Solitaire ring: in its box on the pedestal (EXPLORE, CUSTOMIZE), on the chosen finger in try-on (the same model,
 * re-parented into a HandAnchor). The finger option also sets the band size. Options change colors, numbers and
 * the band geometry only: no shader rebuild. The stone sparkles with a view- and time-dependent TSL term.
 */
export default function Ring({ productId }: { productId: string }) {
  const config = readRingConfig(useAppStore((s) => s.configs[productId]));
  const mode = useAppStore((s) => s.mode);
  const worn = useAppStore((s) => wornProductIds(s).includes(productId));

  const parts = useMemo(() => {
    const metalMat = new MeshPhysicalNodeMaterial({ name: "ring-metal", metalness: 1, roughness: 0.18 });
    const stoneColor = uniform(new Color(STONE_COLOR.diamond));
    const stoneMat = new MeshPhysicalNodeMaterial({ name: "ring-stone", roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0, ior: 2.4 });
    stoneMat.colorNode = stoneColor;
    // Facets flash as they turn toward the viewer; a slow time term keeps a still hand sparkling.
    const facing = abs(dot(normalView, positionViewDirection));
    const flash = pow(abs(sin(dot(normalView, vec3(12.9898, 78.233, 37.719)).mul(9).add(time.mul(2.5)))), float(24));
    stoneMat.emissiveNode = stoneColor.mul(facing.mul(0.25)).add(vec3(flash.mul(0.9)));
    const boxMat = new MeshPhysicalNodeMaterial({ name: "ring-box", color: "#3a0f16", roughness: 0.9, sheen: 1 });
    const occluderMat = depthOnlyMaterial("finger-occluder");

    const geometries: BufferGeometry[] = [];
    const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
    const model = new Group();
    model.name = "ring";
    const band = new Mesh(undefined, metalMat);
    // Setting (cup + 4 prongs) and stone on the back of the finger, at z = band outer radius.
    const head = new Group();
    const cup = new Mesh(keep(new CylinderGeometry(0.0024, 0.0016, 0.0016, 24).rotateX(Math.PI / 2)), metalMat);
    head.add(cup);
    const prongGeo = keep(new CylinderGeometry(0.00035, 0.00035, 0.0034, 8).rotateX(Math.PI / 2));
    for (let i = 0; i < 4; i++) {
      const prong = new Mesh(prongGeo, metalMat);
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      prong.position.set(Math.cos(a) * 0.0026, Math.sin(a) * 0.0026, 0.0012);
      head.add(prong);
    }
    const stone = new Mesh(keep(brilliantGeometry()), stoneMat);
    stone.position.z = 0.0023;
    head.add(stone);
    model.add(band, head);
    model.traverse((o) => (o.frustumCulled = false));

    // Pedestal display: a velvet box with a slot; the ring stands in it.
    const box = new Mesh(keep(new BoxGeometry(0.03, 0.016, 0.026)), boxMat);
    box.position.set(0, -0.019, 0);

    // Try-on: the finger, slightly inside the band, so the back of the band hides behind it.
    const occluder = new Mesh(undefined, occluderMat);
    occluder.renderOrder = -1;
    occluder.frustumCulled = false;

    type Size = { r: number; band: BufferGeometry; finger: BufferGeometry };
    const sizes = {} as Record<Finger, Size>;
    for (const finger of Object.keys(FINGER_RADIUS) as Finger[]) {
      const r = FINGER_RADIUS[finger];
      sizes[finger] = {
        r,
        band: keep(new TorusGeometry(r + TUBE, TUBE, 16, 64).rotateX(Math.PI / 2)),
        finger: keep(new CylinderGeometry(r * 0.96, r * 0.96, 0.05, 24).translate(0, 0.012, 0)),
      };
    }
    band.geometry = sizes.ring.band;
    occluder.geometry = sizes.ring.finger;
    head.position.z = sizes.ring.r + TUBE * 1.6;

    return { model, band, head, stone, box, occluder, sizes, stoneColor, materials: { metalMat, stoneMat, boxMat, occluderMat }, geometries };
  }, []);

  // Band and finger occluder sized for the chosen finger: switched between sizes built once with the parts (and
  // disposed with them). Rebuilding on change and disposing in an effect cleanup could leave the band on a
  // disposed geometry when React re-runs the effect without the memo (remount, re-shown Suspense tree).
  useEffect(() => {
    const size = parts.sizes[config.finger];
    parts.band.geometry = size.band;
    parts.occluder.geometry = size.finger;
    parts.head.position.z = size.r + TUBE * 1.6;
  }, [parts, config.finger]);

  const layout = useMemo(() => {
    // Measured on a throwaway copy laid out like the JSX display below (largest band).
    const measure = new Group();
    measure.scale.setScalar(DISPLAY_SCALE);
    const tilt = new Group();
    tilt.rotation.set(...DISPLAY_ROTATION);
    const model = parts.model.clone();
    const band = new TorusGeometry(FINGER_RADIUS.middle + TUBE, TUBE, 8, 32).rotateX(Math.PI / 2);
    (model.children[0] as Mesh).geometry = band;
    model.children[1].position.z = FINGER_RADIUS.middle + TUBE * 1.6;
    tilt.add(model);
    measure.add(tilt, parts.box.clone());
    const result = restOnPedestal(measure);
    band.dispose();
    return result;
  }, [parts]);

  useEffect(
    () => () => {
      parts.geometries.forEach((g) => g.dispose());
      Object.values(parts.materials).forEach((m) => m.dispose());
    },
    [parts],
  );

  // Live config → materials (colors and numbers only).
  useEffect(() => {
    const metal = METAL_LOOK[config.metal];
    parts.materials.metalMat.color.set(metal.color);
    parts.materials.metalMat.roughness = metal.roughness;
    parts.head.visible = config.stone !== "none";
    if (config.stone !== "none") parts.stoneColor.value.set(STONE_COLOR[config.stone]);
  }, [parts, config.metal, config.stone]);

  if (isTryOnMode(mode) && worn) {
    return (
      <HandAnchor productId={productId} site={config.finger}>
        <primitive object={parts.model} />
        <primitive object={parts.occluder} />
      </HandAnchor>
    );
  }

  // Declarative layout, so React moves the ring back into its box after try-on. The ring alone (upright) is what
  // cart thumbnails render.
  return (
    <PedestalMount productId={productId} hitBox={layout.hitBox}>
      <group position-y={layout.lift} scale={DISPLAY_SCALE}>
        <group rotation={DISPLAY_ROTATION} ref={(g) => setProductModel(productId, g)}>
          <primitive object={parts.model} />
        </group>
        <primitive object={parts.box} />
      </group>
    </PedestalMount>
  );
}
