"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { color } from "three/tsl";
import { IcosahedronGeometry, InstancedMesh, MeshBasicNodeMaterial, Object3D, Vector3 } from "three/webgpu";
import { getCartIcon } from "@/lib/cart/registry";
import { isDebugEnabled } from "@/lib/debug";
import { productPosition } from "@/lib/explore/layout";
import { isTryOnMode } from "@/lib/modes";
import { screenToWorld, worldToScreen } from "@/lib/screenToWorld";
import { isTryOnMirrored } from "@/lib/tryon/constants";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { useAppStore } from "@/store/useAppStore";

const COUNT = 36;
const DURATION = 0.85; // s per particle
const STAGGER = 0.012; // s between particle launches
/** Particle radius as a fraction of its distance to the camera (≈ constant on-screen size). */
const ANGULAR_SIZE = 0.012;

type Burst = { start: number; from: Vector3[]; lift: Vector3[]; landed: boolean[] };

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * "Added to cart" feedback: instanced particles fly from the product along quadratic Bézier curves to
 * the cart icon. The icon's screen position is converted to a world point on the camera ray through it,
 * recomputed every frame, so particles land on the icon at any viewport size (and during resizes).
 */
export default function CartParticles() {
  const fxId = useAppStore((s) => s.cartFxId);
  const gl = useThree((s) => s.gl);
  const mesh = useRef<InstancedMesh>(null);
  const burst = useRef<Burst | null>(null);
  const clock = useRef(0);

  const { geometry, material } = useMemo(() => {
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    // HDR gold so it stays bright through tone mapping and the CUSTOMIZE vignette.
    material.colorNode = color("#ffc24a").mul(1.8);
    return { geometry: new IcosahedronGeometry(1, 1), material };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useEffect(() => {
    if (fxId === 0) return;
    // Reduced motion: no particle burst, just the cart icon acknowledgement.
    if (prefersReducedMotion()) {
      useAppStore.getState().bumpCart();
      return;
    }
    const from: Vector3[] = [];
    const lift: Vector3[] = [];
    const origin = new Vector3(...productPosition(useAppStore.getState().activeProductId));
    for (let i = 0; i < COUNT; i++) {
      from.push(
        new Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04).add(origin),
      );
      lift.push(new Vector3((Math.random() - 0.5) * 0.08, 0.04 + Math.random() * 0.08, (Math.random() - 0.5) * 0.06));
    }
    burst.current = { start: clock.current, from, lift, landed: new Array(COUNT).fill(false) };
    if (isDebugEnabled()) Object.assign(window, { __cartFx: { id: fxId, landed: [] as unknown[] } });
  }, [fxId]);

  const tmp = useMemo(() => ({ o: new Object3D(), target: new Vector3(), control: new Vector3(), p: new Vector3(), a: new Vector3(), b: new Vector3() }), []);

  useFrame(({ camera }, delta) => {
    // Clamp the step so a long frame (tab switch, hitch) doesn't skip the whole animation.
    clock.current += Math.min(delta, 1 / 30);
    const m = mesh.current;
    const b = burst.current;
    const icon = getCartIcon();
    if (!m) return;
    if (!b || !icon) {
      m.visible = false;
      return;
    }
    m.visible = true;

    // Target: world point on the ray through the icon centre, halfway between camera and product.
    const { activeProductId } = useAppStore.getState();
    const rect = gl.domElement.getBoundingClientRect();
    const ir = icon.getBoundingClientRect();
    const { mode, tryOnSource } = useAppStore.getState();
    const mirrored = isTryOnMode(mode) && isTryOnMirrored(tryOnSource);
    const depth = camera.position.distanceTo(tmp.p.set(...productPosition(activeProductId))) * 0.5;
    screenToWorld(ir.left + ir.width / 2, ir.top + ir.height / 2, rect, camera, depth, mirrored, tmp.target);

    let active = 0;
    for (let i = 0; i < COUNT; i++) {
      const t = Math.min(Math.max((clock.current - b.start - i * STAGGER) / DURATION, 0), 1);
      const e = easeInOut(t);
      // Quadratic Bézier: from → (midpoint + lift) → target.
      tmp.control.copy(b.from[i]).add(tmp.target).multiplyScalar(0.5).add(b.lift[i]);
      tmp.a.copy(b.from[i]).lerp(tmp.control, e);
      tmp.b.copy(tmp.control).lerp(tmp.target, e);
      tmp.p.copy(tmp.a).lerp(tmp.b, e);

      const size = t <= 0 || t >= 1 ? 0 : ANGULAR_SIZE * tmp.p.distanceTo(camera.position) * (1 - 0.6 * e);
      tmp.o.position.copy(tmp.p);
      tmp.o.scale.setScalar(size);
      tmp.o.updateMatrix();
      m.setMatrixAt(i, tmp.o.matrix);
      if (t < 1) active++;

      if (t >= 1 && !b.landed[i]) {
        b.landed[i] = true;
        if (i === 0) useAppStore.getState().bumpCart();
        const fx = (window as { __cartFx?: { landed: unknown[] } }).__cartFx;
        if (fx) {
          const s = worldToScreen(tmp.p, rect, camera, mirrored);
          fx.landed.push({ x: s.x, y: s.y, iconX: ir.left + ir.width / 2, iconY: ir.top + ir.height / 2 });
        }
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (active === 0) burst.current = null;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} renderOrder={10} visible={false} />;
}
