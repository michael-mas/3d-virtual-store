import type { Obstacle, Vec2 } from "./layout";
import { isFree, resolveCollisions, type Bounds } from "./movement";

/** Grid resolution of the walkable map (m). */
const CELL = 0.1;
/** Extra clearance kept from obstacles when planning, so the walk doesn't scrape them (m). */
const MARGIN = 0.04;
/** Sampling step when checking that a straight segment is walkable (m). */
const LINE_STEP = 0.05;

export type NavMap = {
  free: Uint8Array;
  cols: number;
  rows: number;
  bounds: Bounds;
  radius: number;
  obstacles: readonly Obstacle[];
};

/** Precomputes which grid cells a player of `radius` (plus a margin) can stand on. */
export function buildNavMap(bounds: Bounds, radius: number, obstacles: readonly Obstacle[]): NavMap {
  const cols = Math.floor((bounds.halfWidth * 2) / CELL) + 1;
  const rows = Math.floor((bounds.halfDepth * 2) / CELL) + 1;
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      free[r * cols + c] = isFree(cellCenter(c, r, bounds), radius + MARGIN, bounds, obstacles) ? 1 : 0;
    }
  }
  return { free, cols, rows, bounds, radius, obstacles };
}

const cellCenter = (c: number, r: number, b: Bounds): Vec2 => [-b.halfWidth + c * CELL, -b.halfDepth + r * CELL];
const cellOf = (p: Vec2, m: NavMap): [number, number] => [
  Math.min(Math.max(Math.round((p[0] + m.bounds.halfWidth) / CELL), 0), m.cols - 1),
  Math.min(Math.max(Math.round((p[1] + m.bounds.halfDepth) / CELL), 0), m.rows - 1),
];

/** Nearest free cell to (c, r), searching outward ring by ring. */
function nearestFree(m: NavMap, c: number, r: number): number | null {
  for (let ring = 0; ring < 20; ring++) {
    let best: number | null = null;
    let bestD = Infinity;
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= m.cols || rr >= m.rows || !m.free[rr * m.cols + cc]) continue;
        const d = dc * dc + dr * dr;
        if (d < bestD) {
          bestD = d;
          best = rr * m.cols + cc;
        }
      }
    }
    if (best !== null) return best;
  }
  return null;
}

/** True when a player can walk the straight segment p → q without touching anything. */
export function lineIsFree(m: NavMap, p: Vec2, q: Vec2): boolean {
  const steps = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / LINE_STEP);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!isFree([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], m.radius, m.bounds, m.obstacles)) return false;
  }
  return true;
}

/**
 * Walkable path from `from` to `to` (the goal is first moved out of any obstacle): A* over the grid, 8-connected,
 * then shortened to the fewest straight legs (a point is skipped when the leg past it is walkable). Returns the
 * waypoints after `from`, ending at the goal; just the goal when the straight line is clear, or [] when unreachable.
 */
export function findPath(m: NavMap, from: Vec2, to: Vec2): Vec2[] {
  const goal = resolveCollisions(to, m.radius, m.bounds, m.obstacles);
  if (lineIsFree(m, from, goal)) return [goal];

  const [sc, sr] = cellOf(from, m);
  const [gc, gr] = cellOf(goal, m);
  const start = nearestFree(m, sc, sr);
  const end = nearestFree(m, gc, gr);
  if (start === null || end === null) return [];

  const n = m.cols * m.rows;
  const g = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const ec = end % m.cols;
  const er = Math.floor(end / m.cols);
  const h = (i: number) => Math.hypot((i % m.cols) - ec, Math.floor(i / m.cols) - er);
  // Binary heap of [f, index].
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (heap[parent][0] <= heap[k][0]) break;
      [heap[parent], heap[k]] = [heap[k], heap[parent]];
      k = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let s = k;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === k) break;
        [heap[s], heap[k]] = [heap[k], heap[s]];
        k = s;
      }
    }
    return top;
  };

  g[start] = 0;
  push(h(start), start);
  while (heap.length > 0) {
    const [, i] = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === end) break;
    const c = i % m.cols;
    const r = Math.floor(i / m.cols);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= m.cols || rr >= m.rows) continue;
        const j = rr * m.cols + cc;
        if (!m.free[j] || closed[j]) continue;
        // No corner cutting between two blocked cells.
        if (dc && dr && (!m.free[r * m.cols + cc] || !m.free[rr * m.cols + c])) continue;
        const cost = g[i] + (dc && dr ? Math.SQRT2 : 1);
        if (cost < g[j]) {
          g[j] = cost;
          came[j] = i;
          push(cost + h(j), j);
        }
      }
    }
  }
  if (!closed[end]) return [];

  const cells: Vec2[] = [];
  for (let i = end; i !== -1; i = came[i]) cells.push(cellCenter(i % m.cols, Math.floor(i / m.cols), m.bounds));
  cells.reverse();
  cells[cells.length - 1] = goal;

  // String pulling: from the current point, jump to the farthest waypoint still in straight sight.
  const path: Vec2[] = [];
  let current = from;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let j = cells.length - 1; j > k; j--) {
      if (lineIsFree(m, current, cells[j])) {
        far = j;
        break;
      }
    }
    path.push(cells[far]);
    current = cells[far];
    k = far + 1;
  }
  return path;
}
