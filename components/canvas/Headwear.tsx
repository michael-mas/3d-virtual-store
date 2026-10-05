"use client";

import { useEffect, useMemo } from "react";
import { abs, float, mix, sin, smoothstep, uniform, uv } from "three/tsl";
import {
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshPhysicalNodeMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from "three/webgpu";
import { wornProductIds } from "@/lib/cart/look";
import { setProductModel } from "@/lib/cart/registry";
import { domeGeometry, domePoint, edgePhi, edgeY, gridGeometry, headBlockGeometries, SKULL, type Dome } from "@/lib/headwear/geometry";
import { isTryOnMode } from "@/lib/modes";
import { HEADWEAR_STYLES, readHeadwearConfig, type HeadwearStyle } from "@/lib/products/headwear";
import { GLASSES_ANCHOR } from "@/lib/tryon/constants";
import { useAppStore } from "@/store/useAppStore";
import { restOnPedestal } from "./displayHelpers";
import FaceAnchor from "./FaceAnchor";
import PedestalMount from "./PedestalMount";

/** FaceAnchor places products at GLASSES_ANCHOR; hats are modeled in canonical face space, so undo that offset. */
const ANCHOR_INVERSE = GLASSES_ANCHOR.map((v) => -v) as [number, number, number];

// Scales above 1 leave room for the hair the hat sits on.
const CAP: Dome = { scale: [1.08, 1.1, 1.08], edgeFront: 0.066, edgeBack: 0.03 };
const BEANIE: Dome = { scale: [1.1, 1.17, 1.1], edgeFront: 0.058, edgeBack: 0.018 };
const BUCKET: Dome = { scale: [1.1, 1.06, 1.1], edgeFront: 0.064, edgeBack: 0.04 };

/** Point on a dome at height y (canonical m) and angle θ, pushed outward by `grow` (fraction of the radii). */
function pointAtHeight(dome: Dome, theta: number, y: number, grow: number, out: Vector3) {
  const grown: Dome = { ...dome, scale: dome.scale.map((s) => s * (1 + grow)) as Dome["scale"] };
  const ry = SKULL.radii.y * grown.scale[1];
  const phi = Math.acos(Math.min(Math.max((y - SKULL.center.y) / ry, -1), 1));
  return domePoint(grown, theta, phi, out);
}

const BELOW = new Vector3(0, -0.3, 0.1);
const tmp = new Vector3();

/** Cap visor: from the front edge, forward and slightly down, shorter toward the sides, edges curving down. */
function visorGeometry(): BufferGeometry {
  return gridGeometry(
    (u, s, out) => {
      const theta = (u - 0.5) * 2.4;
      domePoint(CAP, theta, edgePhi(CAP, theta), out);
      const length = 0.074 * Math.pow(Math.max(Math.cos(theta * 1.1), 0.05), 0.6);
      tmp.set(Math.sin(theta) * 0.6, 0, Math.cos(theta)).normalize();
      out.addScaledVector(tmp, length * s);
      out.y -= 0.014 * s + 0.014 * s * Math.sin(theta * 1.2) ** 2;
      return out;
    },
    40,
    8,
    { inside: BELOW },
  );
}

/** Band around a dome above its edge (beanie cuff, bucket hat band), slightly proud of the surface. */
function bandGeometry(dome: Dome, height: number, grow: number): BufferGeometry {
  return gridGeometry(
    (u, v, out) => {
      const theta = u * Math.PI * 2;
      return pointAtHeight(dome, theta, edgeY(dome, theta) - 0.003 + v * height, grow, out);
    },
    72,
    4,
    { closedU: true, inside: SKULL.center },
  );
}

/** Bucket hat brim: all around, out and down. */
function bucketBrimGeometry(): BufferGeometry {
  return gridGeometry(
    (u, s, out) => {
      const theta = u * Math.PI * 2;
      pointAtHeight(BUCKET, theta, edgeY(BUCKET, theta), 0.005, out);
      out.x += Math.sin(theta) * 0.052 * s;
      out.z += Math.cos(theta) * 0.052 * s;
      out.y -= 0.026 * s;
      return out;
    },
    72,
    6,
    { closedU: true, inside: BELOW },
  );
}

/** Yarn pompom: a jittered icosphere, flat-shaded (deterministic jitter). */
function pompomGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(0.03, 3).toNonIndexed();
  const p = g.getAttribute("position");
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(0.85 + rand() * 0.3);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const top = (dome: Dome) => new Vector3(SKULL.center.x, SKULL.center.y + SKULL.radii.y * dome.scale[1], SKULL.center.z);

/**
 * Headwear: a cap, a beanie or a bucket hat (the style option swaps shapes), shown on a hat block on the pedestal
 * and worn in try-on like glasses (FaceAnchor: head pose, head occluder). Shapes are domes cut along a tilted line
 * on a typical skull (lib/headwear/geometry.ts); the beanie's knit is a TSL rib pattern.
 */
export default function Headwear({ productId }: { productId: string }) {
  const config = readHeadwearConfig(useAppStore((s) => s.configs[productId]));
  const mode = useAppStore((s) => s.mode);
  const worn = useAppStore((s) => wornProductIds(s).includes(productId));

  const parts = useMemo(() => {
    const color = uniform(new Color("#1e3a5f"));
    const fabricMat = new MeshPhysicalNodeMaterial({ name: "hat-fabric", roughness: 0.85, sheen: 0.4, side: DoubleSide });
    fabricMat.colorNode = color;
    const knitMat = new MeshPhysicalNodeMaterial({ name: "hat-knit", roughness: 0.95, sheen: 1, side: DoubleSide });
    // Knit ribs around the head (u), softly shaded.
    const ribs = smoothstep(0.2, 0.8, abs(sin(uv().x.mul(Math.PI * 110))));
    knitMat.colorNode = color.mul(mix(float(0.78), float(1), ribs));
    const accentMat = new MeshPhysicalNodeMaterial({ name: "hat-accent", roughness: 0.8, side: DoubleSide });
    const blockMat = new MeshPhysicalNodeMaterial({ name: "hat-block", color: "#d8c3a5", roughness: 0.6 });

    const geometries: BufferGeometry[] = [];
    const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
    const mesh = (g: BufferGeometry, m: MeshPhysicalNodeMaterial) => new Mesh(keep(g), m);

    const cap = new Group();
    const button = mesh(new SphereGeometry(0.007, 16, 8).scale(1, 0.45, 1), accentMat);
    button.position.copy(top(CAP));
    cap.add(mesh(domeGeometry(CAP), fabricMat), mesh(visorGeometry(), accentMat), button);

    const beanie = new Group();
    const pompom = mesh(pompomGeometry(), accentMat);
    pompom.position.copy(top(BEANIE)).add(new Vector3(0, 0.022, 0));
    beanie.add(mesh(domeGeometry(BEANIE), knitMat), mesh(bandGeometry(BEANIE, 0.034, 0.05), knitMat), pompom);

    const bucket = new Group();
    bucket.add(mesh(domeGeometry(BUCKET), fabricMat), mesh(bandGeometry(BUCKET, 0.014, 0.012), accentMat), mesh(bucketBrimGeometry(), fabricMat));

    const styles: Record<HeadwearStyle, Group> = { cap, beanie, bucket };
    const hat = new Group();
    hat.name = "headwear";
    hat.add(cap, beanie, bucket);
    hat.traverse((o) => (o.frustumCulled = false));

    // Pedestal display: a hat block (the skull) on a short stand.
    const block = new Group();
    const blockGeos = headBlockGeometries();
    block.add(mesh(blockGeos.head, blockMat), mesh(blockGeos.stand, blockMat));

    const measure = new Group();
    measure.add(hat.clone(), block.clone());
    const { lift, hitBox } = restOnPedestal(measure);
    return { hat, block, styles, color, lift, hitBox, materials: { fabricMat, knitMat, accentMat, blockMat }, geometries };
  }, []);

  useEffect(
    () => () => {
      parts.geometries.forEach((g) => g.dispose());
      Object.values(parts.materials).forEach((m) => m.dispose());
    },
    [parts],
  );

  // Live config → shape visibility and colors (no shader rebuild).
  useEffect(() => {
    for (const style of HEADWEAR_STYLES) parts.styles[style].visible = style === config.style;
    parts.color.value.set(config.color);
    parts.materials.accentMat.color.set(config.accent);
  }, [parts, config.style, config.color, config.accent]);

  if (isTryOnMode(mode) && worn) {
    return (
      <FaceAnchor productId={productId}>
        <group position={ANCHOR_INVERSE}>
          <primitive object={parts.hat} />
        </group>
      </FaceAnchor>
    );
  }

  // Declarative layout, so React moves the hat back onto its block after try-on; thumbnails render both.
  return (
    <PedestalMount productId={productId} hitBox={parts.hitBox}>
      <group position-y={parts.lift} ref={(g) => setProductModel(productId, g)}>
        <primitive object={parts.hat} />
        <primitive object={parts.block} />
      </group>
    </PedestalMount>
  );
}
