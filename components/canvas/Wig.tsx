"use client";

import { useEffect, useMemo } from "react";
import { float, mix, pow, sin, uniform, uv } from "three/tsl";
import { Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, type BufferGeometry } from "three/webgpu";
import { wornProductIds } from "@/lib/cart/look";
import { setProductModel } from "@/lib/cart/registry";
import { headBlockGeometries, SKULL, wigGeometry, type WigShape } from "@/lib/headwear/geometry";
import { isTryOnMode } from "@/lib/modes";
import { readWigConfig, WIG_STYLES, type WigStyle } from "@/lib/products/wig";
import { GLASSES_ANCHOR } from "@/lib/tryon/constants";
import { useAppStore } from "@/store/useAppStore";
import { restOnPedestal } from "./displayHelpers";
import FaceAnchor from "./FaceAnchor";
import PedestalMount from "./PedestalMount";

/** FaceAnchor places products at GLASSES_ANCHOR; wigs are modeled in canonical face space, so undo that offset. */
const ANCHOR_INVERSE = GLASSES_ANCHOR.map((v) => -v) as [number, number, number];

const SHAPES: Record<WigStyle, WigShape> = {
  // Chin-length with a fringe.
  bob: { scale: [1.12, 1.1, 1.08], hairline: 0.052, length: -0.045, faceHalfAngle: 0.55, flare: 0.5 },
  // Past the shoulders.
  long: { scale: [1.1, 1.08, 1.08], hairline: 0.072, length: -0.2, faceHalfAngle: 0.62, flare: 0.35 },
  // Rounded volume with curls, ending above the jaw.
  afro: { scale: [1.5, 1.4, 1.4], hairline: 0.075, length: -0.01, faceHalfAngle: 0.7, flare: 0, curls: 0.01 },
};

/**
 * Wig: stylized hair (bob, long waves, afro: the style option swaps shapes) on a head block on the pedestal, worn
 * in try-on like hats (FaceAnchor). The hair follows the skull to its widest line, then falls straight down, with
 * a face opening (lib/headwear/geometry.ts). Strands and curls are TSL patterns over the surface's UVs. A neck
 * occluder hides the hair hanging behind the neck.
 */
export default function Wig({ productId }: { productId: string }) {
  const config = readWigConfig(useAppStore((s) => s.configs[productId]));
  const mode = useAppStore((s) => s.mode);
  const worn = useAppStore((s) => wornProductIds(s).includes(productId));

  const parts = useMemo(() => {
    const color = uniform(new Color("#5a3825"));
    // Strands run down the surface (v): fine stripes around (u) that wander a little, darker toward the roots.
    const strands = sin(uv().x.mul(900).add(sin(uv().y.mul(14)).mul(3)));
    const roots = mix(float(0.7), float(1), pow(uv().y, 0.4));
    const hairMat = new MeshPhysicalNodeMaterial({ name: "wig-hair", roughness: 0.5, sheen: 1, sheenRoughness: 0.4, side: DoubleSide });
    hairMat.colorNode = color.mul(roots).mul(strands.mul(0.12).add(0.9));
    hairMat.sheenNode = color.mul(0.6).add(0.15);
    // Curls: a dense two-way pattern.
    const curlMat = new MeshPhysicalNodeMaterial({ name: "wig-curls", roughness: 0.85, sheen: 1, side: DoubleSide });
    const curls = sin(uv().x.mul(420)).mul(sin(uv().y.mul(140)));
    curlMat.colorNode = color.mul(curls.mul(0.18).add(0.86));
    const blockMat = new MeshPhysicalNodeMaterial({ name: "wig-block", color: "#d8c3a5", roughness: 0.6 });
    const occluderMat = new MeshBasicNodeMaterial({ name: "neck-occluder", colorWrite: false });

    const geometries: BufferGeometry[] = [];
    const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);

    const styles = {} as Record<WigStyle, Mesh>;
    const wig = new Group();
    wig.name = "wig";
    for (const style of WIG_STYLES) {
      styles[style] = new Mesh(keep(wigGeometry(SHAPES[style])), style === "afro" ? curlMat : hairMat);
      wig.add(styles[style]);
    }
    wig.traverse((o) => (o.frustumCulled = false));

    // Try-on: the neck (the head occluder stops at the jaw), so hair hanging behind it stays hidden.
    const neck = new Mesh(keep(new CylinderGeometry(0.055, 0.06, 0.2, 24).translate(SKULL.center.x, -0.15, -0.035)), occluderMat);
    neck.renderOrder = -1;
    neck.frustumCulled = false;

    const block = new Group();
    const blockGeos = headBlockGeometries();
    block.add(new Mesh(keep(blockGeos.head), blockMat), new Mesh(keep(blockGeos.stand), blockMat));

    const measure = new Group();
    const longest = new Mesh(styles.long.geometry);
    measure.add(longest, block.clone());
    const { lift, hitBox } = restOnPedestal(measure);
    return { wig, block, neck, styles, color, lift, hitBox, materials: { hairMat, curlMat, blockMat, occluderMat }, geometries };
  }, []);

  useEffect(
    () => () => {
      parts.geometries.forEach((g) => g.dispose());
      Object.values(parts.materials).forEach((m) => m.dispose());
    },
    [parts],
  );

  // Live config → shape visibility and color (no shader rebuild).
  useEffect(() => {
    for (const style of WIG_STYLES) parts.styles[style].visible = style === config.style;
    parts.color.value.set(config.color);
  }, [parts, config.style, config.color]);

  if (isTryOnMode(mode) && worn) {
    return (
      <FaceAnchor productId={productId}>
        <group position={ANCHOR_INVERSE}>
          <primitive object={parts.wig} />
          <primitive object={parts.neck} />
        </group>
      </FaceAnchor>
    );
  }

  // Declarative layout, so React moves the wig back onto its block after try-on; thumbnails render both.
  return (
    <PedestalMount productId={productId} hitBox={parts.hitBox}>
      <group position-y={parts.lift} ref={(g) => setProductModel(productId, g)}>
        <primitive object={parts.wig} />
        <primitive object={parts.block} />
      </group>
    </PedestalMount>
  );
}
