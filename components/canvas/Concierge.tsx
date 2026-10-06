"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { sin, time, uniform, vec3 } from "three/tsl";
import {
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three/webgpu";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { angleDelta, concierge, conciergeSpot, headingTo, stepConcierge } from "@/lib/explore/concierge";
import { FLOOR_Y, PEDESTALS } from "@/lib/explore/layout";
import { player } from "@/lib/explore/player";
import { CANONICAL_FACE_POSITIONS, EYE_CONTOURS } from "@/lib/tryon/faceMesh";
import { createMannequinGeometry } from "@/lib/tryon/surface/mannequin";
import { useAppStore } from "@/store/useAppStore";

/** Overall scale: a 1.46 m figure (the head stays proportional, so pieces scale with it). */
const SCALE = 0.82;
/** Hover height of the body's lowest point above the floor (m, before SCALE), and its bob. */
const HOVER = 0.3;
const BOB = 0.025;
/** Canonical face origin (near the nose) above the floor: a 1.78 m figure. */
const HEAD_Y = 1.66;
const UPPER_ARM = 0.27;
const FOREARM = 0.25;

/** Centroid (m, canonical face space) of a closed landmark loop. */
function centroid(loop: readonly number[]): [number, number, number] {
  const c = [0, 0, 0];
  for (const i of loop) for (let k = 0; k < 3; k++) c[k] += CANONICAL_FACE_POSITIONS[i * 3 + k] * 0.01;
  return c.map((v) => v / loop.length) as [number, number, number];
}

/** One arm: a floating shoulder, upper arm and forearm capsules, a slim hand; pivots at shoulder and elbow. */
function arm(side: 1 | -1, lacquer: MeshPhysicalNodeMaterial, brass: MeshPhysicalNodeMaterial, keep: (g: BufferGeometry) => BufferGeometry) {
  const shoulder = new Group();
  shoulder.position.set(side * 0.27, 1.37, 0);
  shoulder.add(new Mesh(keep(new SphereGeometry(0.062, 24, 16)), brass));
  const upper = new Mesh(keep(new CapsuleGeometry(0.038, UPPER_ARM - 0.076, 6, 16)), lacquer);
  upper.position.y = -UPPER_ARM / 2 - 0.05;
  const elbow = new Group();
  // Bend forward first (x), then turn the forearm toward the body (y).
  elbow.rotation.order = "YXZ";
  elbow.position.y = -UPPER_ARM - 0.05;
  elbow.add(new Mesh(keep(new SphereGeometry(0.036, 16, 12)), brass));
  const fore = new Mesh(keep(new CapsuleGeometry(0.032, FOREARM - 0.064, 6, 16)), lacquer);
  fore.position.y = -FOREARM / 2;
  const hand = new Mesh(keep(new CapsuleGeometry(0.03, 0.05, 6, 12).scale(1, 1, 0.55)), brass);
  hand.position.y = -FOREARM - 0.05;
  elbow.add(fore, hand);
  shoulder.add(upper, elbow);
  return { shoulder, elbow };
}

/**
 * The house concierge: a hovering black-lacquer-and-brass android whose head is MediaPipe's canonical face (the
 * same space the try-on uses, so pieces will fit it exactly). In EXPLORE it glides beside the player (ahead and to
 * the right of the view), faces them, and in front of a pedestal turns to the piece and gestures toward it (its
 * words are in ConciergePanel). Hidden outside EXPLORE. Procedural (no model file): about twenty meshes, physical TSL materials.
 */
export default function Concierge() {
  const mode = useAppStore((s) => s.mode);
  const reducedMotion = useReducedMotion();
  const root = useRef<Group>(null);


  const parts = useMemo(() => {
    const geometries: BufferGeometry[] = [];
    const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
    const lacquer = new MeshPhysicalNodeMaterial({ name: "concierge-lacquer", color: "#0d0c0b", roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
    const brass = new MeshPhysicalNodeMaterial({ name: "concierge-brass", color: "#c8a96a", metalness: 1, roughness: 0.25 });
    const porcelain = new MeshPhysicalNodeMaterial({ name: "concierge-porcelain", color: "#ece6dc", roughness: 0.35, clearcoat: 0.6, sheen: 0.3 });
    // Eyes: a soft warm glow that breathes.
    const eyeGlow = uniform(1);
    const eyes = new MeshBasicNodeMaterial({ name: "concierge-eyes" });
    eyes.colorNode = vec3(1, 0.86, 0.6).mul(eyeGlow.mul(sin(time.mul(1.7)).mul(0.15).add(1.6)));

    const model = new Group();
    model.name = "concierge";
    model.scale.setScalar(SCALE);
    const body = new Group();
    model.add(body);

    // Body: a lathe from the hovering hem to the shoulders, flattened front to back.
    const profile = [
      [0, HOVER],
      [0.13, HOVER],
      [0.2, 0.62],
      [0.17, 0.82],
      [0.13, 0.97],
      [0.17, 1.15],
      [0.2, 1.28],
      [0.15, 1.4],
      [0.06, 1.47],
      [0, 1.47],
    ].map(([a, b]) => new Vector2(a, b));
    body.add(new Mesh(keep(new LatheGeometry(profile, 48).scale(1.15, 1, 0.78)), lacquer));
    const ring = (radius: number, y: number, tube = 0.006, sx = 1.15, sz = 0.78) => {
      const m = new Mesh(keep(new TorusGeometry(radius, tube, 8, 64).rotateX(Math.PI / 2).scale(sx, 1, sz)), brass);
      m.position.y = y;
      return m;
    };
    body.add(ring(0.13, HOVER, 0.012), ring(0.13, 0.97), ring(0.2, 1.28, 0.005), ring(0.065, 1.46, 0.01, 1, 1));
    // Brooch: the house monogram's arch, on the chest.
    const brooch = new Mesh(keep(new TorusGeometry(0.022, 0.004, 8, 24, Math.PI)), brass);
    brooch.position.set(0.07, 1.2, 0.152);
    body.add(brooch);
    const neck = new Mesh(keep(new CylinderGeometry(0.034, 0.042, 0.12, 24)), lacquer);
    neck.position.y = 1.52;
    body.add(neck);

    // Head: the canonical face in porcelain under a lacquer shell, a brass crest, glowing eyes.
    const head = new Group();
    head.position.set(0, HEAD_Y, 0.03);
    const mannequin = createMannequinGeometry();
    geometries.push(mannequin.face, mannequin.head, mannequin.neck);
    const shell = new Mesh(mannequin.head, lacquer);
    shell.scale.setScalar(1.04);
    head.add(new Mesh(mannequin.face, porcelain), shell);
    const crest = new Mesh(keep(new TorusGeometry(0.1, 0.004, 6, 48, Math.PI * 0.8).rotateY(Math.PI / 2).rotateX(Math.PI * 0.1)), brass);
    crest.position.set(0, 0.012, -0.056);
    head.add(crest);
    for (const loop of [EYE_CONTOURS.left, EYE_CONTOURS.right]) {
      const [x, y, z] = centroid(loop);
      const eye = new Mesh(keep(new SphereGeometry(0.0085, 16, 8).scale(1.5, 0.55, 0.4)), eyes);
      eye.position.set(x, y, z + 0.004);
      head.add(eye);
    }
    body.add(head);

    const left = arm(1, lacquer, brass, keep);
    const right = arm(-1, lacquer, brass, keep);
    body.add(left.shoulder, right.shoulder);

    model.traverse((o) => {
      o.frustumCulled = false;
      if (o instanceof Mesh) o.raycast = () => {};
    });
    return { model, body, head, left, right, eyeGlow, materials: { lacquer, brass, porcelain, eyes }, geometries };
  }, []);

  useEffect(
    () => () => {
      parts.geometries.forEach((g) => g.dispose());
      Object.values(parts.materials).forEach((m) => m.dispose());
    },
    [parts],
  );

  const forward = useMemo(() => new Vector3(), []);
  const gesture = useRef(0);

  useFrame(({ camera, clock }, delta) => {
    const g = root.current;
    if (!g || useAppStore.getState().mode !== "EXPLORE") return;
    const dt = Math.min(delta, 0.1);
    camera.getWorldDirection(forward);
    const nearId = useAppStore.getState().nearPedestal;
    const piece = nearId ? PEDESTALS.find((p) => p.productId === nearId) : undefined;
    const spot = conciergeSpot(player.position, [forward.x, forward.z]);
    // Faces the visitor; in front of a piece, turns toward it.
    const face = piece ? piece.position : player.position;
    const next = stepConcierge(concierge, spot, face, dt);
    concierge.position = next.position;
    concierge.velocity = next.velocity;
    concierge.heading = next.heading;

    const tt = clock.elapsedTime;
    const bob = reducedMotion ? 0 : Math.sin(tt * 1.6) * BOB;
    g.position.set(concierge.position[0], FLOOR_Y + bob, concierge.position[1]);
    g.rotation.y = concierge.heading;
    // Leans a little into its glide.
    const lean = Math.min(Math.hypot(...concierge.velocity) * 0.06, 0.12);
    parts.body.rotation.x += (lean - parts.body.rotation.x) * (1 - Math.exp(-6 * dt));

    // The head looks at the visitor even while the body faces a piece (bounded turn).
    const look = angleDelta(concierge.heading, headingTo(concierge.position, player.position));
    parts.head.rotation.y += (Math.max(-0.9, Math.min(0.9, look)) - parts.head.rotation.y) * (1 - Math.exp(-6 * dt));

    // Arms: hands joined in front at rest; the right arm opens toward the piece when presenting.
    gesture.current += ((piece ? 1 : 0) - gesture.current) * (1 - Math.exp(-4 * dt));
    const w = gesture.current;
    const sway = reducedMotion ? 0 : Math.sin(tt * 1.6 + 0.6) * 0.04;
    // Left arm at +x: z < 0 brings it in; the elbow's y turn brings the forearm toward the midline.
    parts.left.shoulder.rotation.set(-0.3 + sway, 0, -0.08);
    parts.left.elbow.rotation.set(-1.15, -0.75, 0);
    parts.right.shoulder.rotation.set(-0.3 - w * 0.95 + sway, 0, 0.08 - w * 0.55);
    parts.right.elbow.rotation.set(-1.15 + w * 0.9, 0.75 - w * 0.75, 0);
  });

  if (mode !== "EXPLORE") return null;
  return (
    <group ref={root}>
      <primitive object={parts.model} />
    </group>
  );
}
