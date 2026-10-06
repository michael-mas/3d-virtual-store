"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { sin, time, vec3 } from "three/tsl";
import { Group, Mesh, MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, TorusGeometry, Vector3 } from "three/webgpu";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { isDebugEnabled } from "@/lib/debug";
import { buildFace } from "@/lib/concierge/face";
import { buildConciergeRig, FULL_WALK_SPEED, poseConcierge, STRIDE } from "@/lib/concierge/rig";
import { isSpeaking, mouthOpenAt, say, speech } from "@/lib/concierge/speech";
import { angleDelta, concierge, conciergeSpot, headingTo, stepConcierge } from "@/lib/explore/concierge";
import { FLOOR_Y, GALLERY, PEDESTALS } from "@/lib/explore/layout";
import { player } from "@/lib/explore/player";
import { getArtwork } from "@/lib/gallery/artworks";
import { STAGE_CENTER } from "@/lib/gallery/show";
import { show } from "@/lib/gallery/stage";
import { createMannequinGeometry } from "@/lib/tryon/surface/mannequin";
import { useAppStore } from "@/store/useAppStore";

/** Overall scale: a 1.56 m figure (the face scales with it; pieces worn on it will too). */
const SCALE = 0.92;
/** Height of the visitor's eyes the concierge looks at (m above the floor). */
const VISITOR_EYES = 1.6;
/** Bounds of the gaze (rad). */
const LOOK_YAW = 1.1;
const LOOK_PITCH = 0.35;

/** Frame-rate independent approach of `value` to `target` at `rate` (1/s). */
const ease = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));

/**
 * The house concierge: an articulated android in black lacquer, brass and dark flexible joints (lib/concierge/rig.ts:
 * pelvis to head, clavicles to five three-phalanx fingers, hips to toes, after PointForge's VANTA-9 anatomy). Its
 * head is MediaPipe's canonical face in porcelain under a lacquer shell with a swept brass crest, so face pieces fit
 * it exactly. In EXPLORE it walks beside the visitor (procedural gait from its speed, arms swinging in opposition,
 * breathing at rest), keeps them in its gaze, and in front of a pedestal or a gallery work turns to it and presents
 * it with an open hand (its words are in ConciergePanel); it follows the visitor into the gallery, through the doors. Hidden outside EXPLORE. Procedural: no model file.
 */
export default function Concierge() {
  const mode = useAppStore((s) => s.mode);
  const reducedMotion = useReducedMotion();
  const root = useRef<Group>(null);

  const parts = useMemo(() => {
    const shell = new MeshPhysicalNodeMaterial({ name: "concierge-lacquer", color: "#0d0c0b", roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
    const joint = new MeshPhysicalNodeMaterial({ name: "concierge-brass", color: "#c8a96a", metalness: 1, roughness: 0.25 });
    const flex = new MeshPhysicalNodeMaterial({ name: "concierge-flex", color: "#2a2622", roughness: 0.75, sheen: 0.6, sheenRoughness: 0.5 });
    const porcelain = new MeshPhysicalNodeMaterial({ name: "concierge-porcelain", color: "#cfc6b8", roughness: 0.42, clearcoat: 0.5, sheen: 0.25 });
    const glass = new MeshPhysicalNodeMaterial({ name: "concierge-eye-glass", color: "#050505", roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
    // Pupils: a soft warm glow that breathes.
    const pupil = new MeshBasicNodeMaterial({ name: "concierge-pupil" });
    pupil.colorNode = vec3(1, 0.82, 0.52).mul(sin(time.mul(1.7)).mul(0.15).add(1.7));
    const cavity = new MeshBasicNodeMaterial({ name: "concierge-mouth", color: "#060505" });

    const rig = buildConciergeRig({ shell, joint, flex });
    const mannequin = createMannequinGeometry();
    rig.geometries.push(mannequin.head);
    mannequin.face.dispose();
    mannequin.neck.dispose();
    const helmet = new Mesh(mannequin.head, shell);
    helmet.scale.setScalar(1.05);
    const face = buildFace({ porcelain, glass, iris: joint, pupil, cavity, brass: joint });
    rig.geometries.push(...face.geometries);
    rig.head.add(face.group, helmet);
    // Swept crest: three brass fins along the top of the helmet, rising toward the back.
    for (const [i, r] of [0.098, 0.104, 0.11].entries()) {
      const fin = new Mesh(new TorusGeometry(r, 0.0035, 6, 40, Math.PI * (0.5 + i * 0.08)), joint);
      rig.geometries.push(fin.geometry);
      fin.rotation.set(Math.PI * 0.12, Math.PI / 2, 0);
      fin.position.set((i - 1) * 0.022, 0.014, -0.058);
      rig.head.add(fin);
    }
    rig.root.scale.setScalar(SCALE);
    rig.root.traverse((o) => {
      o.frustumCulled = false;
      if (o instanceof Mesh) o.raycast = () => {};
    });
    // Mounted once and kept for the app's lifetime: its GPU resources are never disposed (disposing memoized
    // resources in an effect cleanup breaks them when React re-runs the effect without the memo).
    return { rig, face };
  }, []);

  // Debug-only handle for scripted views of the concierge (screenshots, demo GIF).
  useEffect(() => {
    if (isDebugEnabled()) Object.assign(window, { __concierge: concierge, __say: (text: string) => say(text, performance.now() / 1000) });
  }, []);

  const forward = useMemo(() => new Vector3(), []);
  const motion = useRef({ phase: 0, walk: 0, present: 0, yaw: 0, pitch: 0, jaw: 0, brow: 0, nextBlink: 2, blink: 0 });

  useFrame(({ camera, clock }, delta) => {
    const g = root.current;
    if (!g || useAppStore.getState().mode !== "EXPLORE") return;
    const dt = Math.min(delta, 0.1);
    camera.getWorldDirection(forward);
    const nearId = useAppStore.getState().nearPedestal;
    const piece = nearId ? PEDESTALS.find((p) => p.productId === nearId) : undefined;
    const workId = useAppStore.getState().nearArtwork;
    const work = workId ? getArtwork(workId) : undefined;
    // During the performance it takes a seat at the side of the audience, out of the shots.
    const spot: [number, number] = show.playing ? [GALLERY.audience[0] - 3.2, GALLERY.audience[1] - 0.6] : conciergeSpot(player.position, [forward.x, forward.z]);
    // Faces the visitor; in front of a piece or a work, turns toward it.
    // During the performance it watches the stage, like the visitor.
    const face: [number, number] = show.playing
      ? [STAGE_CENTER[0], STAGE_CENTER[2]]
      : piece
        ? piece.position
        : work
          ? [work.center[0], work.center[2]]
          : player.position;
    const before = concierge.position;
    // Debug-only: a frozen concierge keeps its place (close-up screenshots move the camera it follows).
    const frozen = (concierge as { frozen?: boolean }).frozen === true;
    const next = frozen ? { ...concierge, velocity: [0, 0] as [number, number] } : stepConcierge(concierge, spot, face, dt);
    concierge.position = next.position;
    concierge.velocity = next.velocity;
    concierge.heading = next.heading;
    g.position.set(concierge.position[0], FLOOR_Y, concierge.position[1]);
    g.rotation.y = concierge.heading;

    // Gait: the phase advances with the distance actually walked, so feet don't slide.
    const m = motion.current;
    const walked = Math.hypot(concierge.position[0] - before[0], concierge.position[1] - before[1]);
    m.phase += (walked / STRIDE) * Math.PI * 2;
    m.walk = ease(m.walk, Math.min(walked / Math.max(dt, 1e-3) / FULL_WALK_SPEED, 1), 6, dt);
    m.present = ease(m.present, (piece || work) && !show.playing && m.walk < 0.3 ? 1 : 0, 3.5, dt);
    // Gaze at the visitor's eyes, bounded; the body may face the piece meanwhile.
    const yaw = angleDelta(concierge.heading, headingTo(concierge.position, player.position));
    const dist = Math.hypot(player.position[0] - concierge.position[0], player.position[1] - concierge.position[1]);
    const pitch = Math.atan2(VISITOR_EYES - 1.62 * SCALE, Math.max(dist, 0.3));
    m.yaw = ease(m.yaw, Math.max(-LOOK_YAW, Math.min(LOOK_YAW, yaw)), 5, dt);
    m.pitch = ease(m.pitch, Math.max(-LOOK_PITCH, Math.min(LOOK_PITCH, -pitch)), 5, dt);

    // Face: speech drives the jaw (and lifts the brows a little), the eyes look at the visitor and blink.
    const now = performance.now() / 1000;
    const talking = isSpeaking(speech.current, now);
    m.jaw = ease(m.jaw, mouthOpenAt(speech.current, now), 22, dt);
    parts.face.jaw.value = m.jaw;
    m.brow = ease(m.brow, talking ? 0.0016 + 0.0012 * Math.sin(now * 3.1) : 0, 6, dt);
    parts.face.brows.forEach((b, i) => (b.position.y = parts.face.browRest[i] + m.brow));
    if (now > m.nextBlink) {
      m.blink = now;
      m.nextBlink = now + 2.2 + Math.random() * 3.5;
    }
    const lid = Math.max(0, 1 - Math.abs(now - m.blink - 0.07) / 0.07);
    for (const eye of parts.face.eyes) {
      eye.lid.scale.y = Math.max(0.001, lid);
      // Eyes take the part of the gaze the head leaves (bounded within the socket).
      eye.ball.rotation.y = Math.max(-0.35, Math.min(0.35, (yaw - m.yaw) * 0.6 + m.yaw * 0.25));
      eye.ball.rotation.x = Math.max(-0.2, Math.min(0.2, m.pitch * 0.4));
    }

    poseConcierge(parts.rig, {
      phase: m.phase,
      walk: m.walk,
      present: Math.max(m.present, talking ? 0.25 : 0),
      lookYaw: m.yaw,
      lookPitch: m.pitch,
      time: reducedMotion ? 0 : clock.elapsedTime,
    });
  });

  if (mode !== "EXPLORE") return null;
  return (
    <group ref={root}>
      <primitive object={parts.rig.root} />
    </group>
  );
}
