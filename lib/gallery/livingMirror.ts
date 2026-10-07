import { cos, float, floor, instanceIndex, luminance, mix, mod, normalLocal, normalize, positionLocal, sin, smoothstep, texture, transformNormalToView, uniform, vec2, vec3 } from "three/tsl";
import { CylinderGeometry, DataTexture, InstancedMesh, MeshPhysicalNodeMaterial, SRGBColorSpace, VideoTexture } from "three/webgpu";
import { stageUniforms as s } from "./stage";

/**
 * « Le Miroir vivant »: a wall of brass tiles that tilt to draw the visitor in light (after the mechanical mirrors
 * of kinetic art). With the visitor's consent, the front camera's image is sampled per tile in the vertex shader (as
 * a mirror: flipped), its brightness tilting each tile toward the light and lighting it a little; nothing is
 * recorded, nothing leaves the device, and the camera stops when the visitor walks away. Without it, the tiles
 * ripple slowly. One instanced draw.
 */

export const TILES = 30;

/** 1 while the camera image drives the tiles (eased), and the image's own aspect. */
const live = uniform(0);
const aspect = uniform(4 / 3);
const placeholder = new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
placeholder.needsUpdate = true;
const image = texture(placeholder);

let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let liveTarget = 0;

export function buildLivingMirror(width: number, height: number): InstancedMesh {
  const size = width / TILES;
  const geometry = new CylinderGeometry(size * 0.46, size * 0.46, 0.008, 18).rotateX(Math.PI / 2);
  const material = new MeshPhysicalNodeMaterial({ name: "living-mirror", color: "#d6b26a", metalness: 1, roughness: 0.38 });

  const i = float(instanceIndex);
  const col = mod(i, TILES);
  const row = floor(i.div(TILES));
  const u = col.add(0.5).div(TILES);
  const v = row.add(0.5).div(TILES);
  // The camera's image, as a mirror (flipped), cropped to a square in the middle of the frame.
  const crop = vec2(u.oneMinus().sub(0.5).div(aspect).add(0.5), v);
  const seen = smoothstep(0.08, 0.85, luminance(image.sample(crop).rgb));
  // At rest: a slow ripple from the center.
  const d = vec2(u.sub(0.5), v.sub(0.5)).length();
  const rest = sin(d.mul(14).sub(s.clock.mul(1.2))).mul(0.5).add(0.5);
  const value = mix(rest.mul(0.55).add(0.15), seen, live);
  // Bright tiles turn up toward the ceiling's light, dark ones down.
  const angle = value.sub(0.5).mul(-1.7);
  const ca = cos(angle);
  const sa = sin(angle);
  const p = positionLocal;
  const rotated = vec3(p.x, p.y.mul(ca).sub(p.z.mul(sa)), p.y.mul(sa).add(p.z.mul(ca)));
  material.positionNode = rotated.add(vec3(u.sub(0.5).mul(width), v.sub(0.5).mul(height), 0.012));
  const n = normalLocal;
  material.normalNode = transformNormalToView(normalize(vec3(n.x, n.y.mul(ca).sub(n.z.mul(sa)), n.y.mul(sa).add(n.z.mul(ca)))));
  // A little light of their own, so the image reads in the dark room (and dims with the house lights).
  material.emissiveNode = vec3(1, 0.72, 0.36).mul(value.pow(2.2)).mul(mix(float(0.015), float(0.16), live)).mul(s.house.mul(0.6).add(0.4));

  const mesh = new InstancedMesh(geometry, material, TILES * TILES);
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return mesh;
}

/** Asks for the front camera (from a click) and lets its image drive the tiles. Returns false if refused. */
export async function lendReflection(): Promise<boolean> {
  if (stream) return true;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
  } catch {
    return false;
  }
  video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => {});
  aspect.value = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3;
  const tex = new VideoTexture(video);
  tex.colorSpace = SRGBColorSpace;
  image.value = tex;
  liveTarget = 1;
  return true;
}

/** Stops the camera (the visitor walked away, or left the gallery). */
export function withdrawReflection() {
  liveTarget = 0;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (video) video.srcObject = null;
  video = null;
}

export const reflectionLent = () => stream !== null;

/** Eases the image in and out; once faded out, back to the placeholder. */
export function stepLivingMirror(dt: number) {
  live.value += (liveTarget - live.value) * (1 - Math.exp(-dt * 2.5));
  if (liveTarget === 0 && live.value < 0.01 && image.value !== placeholder) {
    image.value.dispose();
    image.value = placeholder;
  }
}
