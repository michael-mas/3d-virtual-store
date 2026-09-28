import type { ThreeToJSXElements } from "@react-three/fiber";
import type * as THREE from "three/webgpu";

// Expose three/webgpu classes (e.g. <meshPhysicalNodeMaterial />) as JSX elements.
declare module "@react-three/fiber" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
