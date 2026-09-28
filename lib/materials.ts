import { MeshPhysicalNodeMaterial } from "three/webgpu";
import { abs, dot, hue, normalView, oneMinus, positionLocal, positionViewDirection, pow, time, vec3 } from "three/tsl";
import type { FrameFinish, LensEffect } from "./products/glasses";

export type FrameMaterials = Record<FrameFinish, MeshPhysicalNodeMaterial>;
export type LensMaterials = Record<LensEffect, MeshPhysicalNodeMaterial>;

/**
 * One pre-built material per option. Switching options swaps `mesh.material` instead of mutating
 * properties: toggling transmission/iridescence bumps `material.version` and forces a shader rebuild.
 */
export function createFrameMaterials(): FrameMaterials {
  return {
    matte: new MeshPhysicalNodeMaterial({ name: "frame-matte", roughness: 0.75, metalness: 0 }),
    metal: new MeshPhysicalNodeMaterial({ name: "frame-metal", roughness: 0.22, metalness: 1 }),
    glass: new MeshPhysicalNodeMaterial({
      name: "frame-glass",
      roughness: 0.06,
      metalness: 0,
      transmission: 1,
      thickness: 0.004,
      ior: 1.5,
      attenuationDistance: 0.01,
    }),
  };
}

export function setFrameColor(materials: FrameMaterials, color: string) {
  materials.matte.color.set(color);
  materials.metal.color.set(color);
  // Glass: tint through absorption so the frame stays see-through.
  materials.glass.color.set("#ffffff");
  materials.glass.attenuationColor.set(color);
}

export function createLensMaterials(): LensMaterials {
  // Low specular = anti-reflective coating: at full strength the flat lenses mirror the environment's
  // light panels and turn milky over the eyes.
  const base = { roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.0016, ior: 1.5, specularIntensity: 0.2 };

  const holographic = new MeshPhysicalNodeMaterial({ name: "lens-holographic", ...base, transmission: 0.85 });
  // Fresnel term: 0 facing the camera, 1 at grazing angles.
  const facing = abs(dot(normalView, positionViewDirection));
  const fresnel = pow(oneMinus(facing), 2.0);
  // Hue rotates with view angle, position across the lens, and time.
  const angle = facing.mul(6.0).add(positionLocal.x.mul(120.0)).add(time.mul(0.8));
  const rainbow = hue(vec3(1.0, 0.15, 0.15), angle);
  holographic.emissiveNode = rainbow.mul(fresnel.mul(1.4).add(0.08));

  return {
    clear: new MeshPhysicalNodeMaterial({ name: "lens-clear", ...base }),
    iridescent: new MeshPhysicalNodeMaterial({
      name: "lens-iridescent",
      ...base,
      transmission: 0.9,
      specularIntensity: 0.6,
      iridescence: 1,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: [250, 800],
    }),
    holographic,
  };
}

export function disposeMaterials(materials: FrameMaterials | LensMaterials) {
  for (const m of Object.values(materials)) m.dispose();
}
