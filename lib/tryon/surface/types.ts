import type { Material } from "three/webgpu";
import type { ProductConfig } from "@/lib/products";

/** A surface try-on product: a material for the face mesh layer, driven by the product configuration. */
export type SurfaceProduct = {
  material: Material;
  /** Subset of face mesh triangles to draw (vertex indices); all paintable triangles when omitted. */
  triangles?: number[];
  /** Applies a (validated) configuration: uniforms only, no shader rebuild. Cheap to call every frame. */
  apply(config: ProductConfig): void;
  /** Per-frame hook with the latest landmarks (flat x, y, z) and the video aspect. */
  update?(landmarks: ArrayLike<number>, aspect: number): void;
  dispose(): void;
};
