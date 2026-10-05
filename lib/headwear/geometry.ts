import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three/webgpu";

/**
 * A typical skull as an ellipsoid in MediaPipe's canonical face space (meters: origin near the nose, +Y up, +Z toward
 * the camera), fitted to enclose the canonical forehead (every vertex above 3 cm is within 0.91 of its normalized
 * radius, so a hat at 1.03–1.07× clears the face mesh that occludes it). Unlike the head occluder's ellipsoid, which
 * stays inside the face silhouette on purpose: hats sit on the forehead, above the ears and on the back of the head.
 */
export const SKULL = { center: new Vector3(0, 0.02, -0.022), radii: new Vector3(0.082, 0.105, 0.097) };

export type Dome = {
  /** Radii multipliers over SKULL (a little more than 1 leaves room for hair). */
  scale: [number, number, number];
  /** Height (canonical y, m) of the lower edge at the front (forehead) and at the back (nape side). */
  edgeFront: number;
  edgeBack: number;
};

/** Height of the dome's lower edge at angle θ around the head (0 = front, toward +x at π/2). */
export const edgeY = (dome: Dome, theta: number) =>
  (dome.edgeFront + dome.edgeBack) / 2 + ((dome.edgeFront - dome.edgeBack) / 2) * Math.cos(theta);

/** Point on the dome at angle θ around the head and polar angle φ from the top. */
export function domePoint(dome: Dome, theta: number, phi: number, out = new Vector3()): Vector3 {
  const { center: c, radii: r } = SKULL;
  const [sx, sy, sz] = dome.scale;
  return out.set(
    c.x + r.x * sx * Math.sin(phi) * Math.sin(theta),
    c.y + r.y * sy * Math.cos(phi),
    c.z + r.z * sz * Math.sin(phi) * Math.cos(theta),
  );
}

/** Polar angle of the lower edge at θ (where the dome meets its tilted cut plane). */
export function edgePhi(dome: Dome, theta: number): number {
  const ry = SKULL.radii.y * dome.scale[1];
  return Math.acos(Math.min(Math.max((edgeY(dome, theta) - SKULL.center.y) / ry, -1), 1));
}

/**
 * Indexed grid geometry from a point function over (u, v) ∈ [0, 1]², with UVs. `closedU` wraps u (around the head)
 * without a duplicated seam column. Faces are wound so normals point away from `inside`.
 */
export function gridGeometry(
  point: (u: number, v: number, out: Vector3) => Vector3,
  segmentsU: number,
  segmentsV: number,
  { closedU = false, inside }: { closedU?: boolean; inside: Vector3 },
): BufferGeometry {
  const columns = closedU ? segmentsU : segmentsU + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const p = new Vector3();
  for (let j = 0; j <= segmentsV; j++) {
    for (let i = 0; i < columns; i++) {
      point(i / segmentsU, j / segmentsV, p);
      positions.push(p.x, p.y, p.z);
      uvs.push(i / segmentsU, j / segmentsV);
    }
  }
  const at = (k: number) => new Vector3(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]);
  // Pick the winding from one well-formed quad (away from the pole row).
  const j0 = Math.max(1, Math.floor(segmentsV / 2));
  const a0 = at(j0 * columns);
  const n0 = at(j0 * columns + 1).sub(a0).cross(at((j0 + 1) * columns).sub(a0));
  const flip = n0.dot(a0.clone().sub(inside)) < 0;
  const index: number[] = [];
  for (let j = 0; j < segmentsV; j++) {
    for (let i = 0; i < segmentsU; i++) {
      const i2 = closedU ? (i + 1) % columns : i + 1;
      const a = j * columns + i;
      const b = j * columns + i2;
      const c = (j + 1) * columns + i;
      const d = (j + 1) * columns + i2;
      if (flip) index.push(a, c, b, b, c, d);
      else index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** The dome surface from the top down to its tilted lower edge (u around the head, v from top to edge). */
export function domeGeometry(dome: Dome, segmentsU = 72, segmentsV = 28): BufferGeometry {
  return gridGeometry(
    (u, v, out) => {
      const theta = u * Math.PI * 2;
      return domePoint(dome, theta, v * edgePhi(dome, theta), out);
    },
    segmentsU,
    segmentsV,
    { closedU: true, inside: SKULL.center },
  );
}
