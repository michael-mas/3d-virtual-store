import { describe, expect, it } from "vitest";
import { MeshBasicMaterial, MeshPhysicalNodeMaterial } from "three/webgpu";
import { FACE_MESH_TRIANGLES, MOUTH_TRIANGLES } from "@/lib/tryon/faceMesh";
import { buildFace } from "./face";

describe("concierge face", () => {
  const m = new MeshBasicMaterial();
  const face = buildFace({ porcelain: new MeshPhysicalNodeMaterial(), glass: m, iris: m, pupil: m, cavity: m, brass: m });

  it("cuts the eyes and the mouth out of the canonical face", () => {
    const mesh = face.group.children[0] as unknown as { geometry: { index: { count: number } } };
    const removed = FACE_MESH_TRIANGLES.length / 3 - mesh.geometry.index.count / 3;
    // The mouth-closing triangles plus the ones inside each eye contour.
    expect(removed).toBeGreaterThan(MOUTH_TRIANGLES.length);
    expect(removed).toBeLessThan(MOUTH_TRIANGLES.length + 60);
  });

  it("has two eyes with lids open at rest, two brows and a closed jaw", () => {
    expect(face.eyes).toHaveLength(2);
    for (const eye of face.eyes) expect(eye.lid.scale.y).toBeLessThan(0.01);
    expect(face.brows).toHaveLength(2);
    expect(face.jaw.value).toBe(0);
    // Symmetric eyes.
    expect(face.eyes[0].ball.position.x).toBeCloseTo(-face.eyes[1].ball.position.x, 6);
  });
});
