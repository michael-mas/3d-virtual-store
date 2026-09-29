/**
 * How open the mouth is, from normalized landmarks (flat x, y, z): the gap between the inner lip midpoints
 * (13 upper, 14 lower) over the inner mouth width (corners 78, 308). x is scaled by the video aspect so both
 * distances are in the same units. ~0 closed, ~0.1 slightly parted, 0.2+ open or a wide smile showing teeth.
 */
export function mouthOpenness(landmarks: ArrayLike<number>, aspect: number): number {
  const dist = (a: number, b: number) =>
    Math.hypot((landmarks[a * 3] - landmarks[b * 3]) * aspect, landmarks[a * 3 + 1] - landmarks[b * 3 + 1]);
  const width = dist(78, 308);
  return width > 1e-6 ? dist(13, 14) / width : 0;
}

/** 1 when the lips touch (the gap between them is a crease to paint over), 0 once they part. */
export function mouthClosedAmount(openness: number): number {
  const t = Math.min(1, Math.max(0, (openness - 0.04) / (0.1 - 0.04)));
  return 1 - t * t * (3 - 2 * t);
}
