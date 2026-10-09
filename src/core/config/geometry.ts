/** Shortest distance from (x, y) to a polyline given as [x, y] points. */
export function polylineDistance(
  points: ReadonlyArray<readonly [number, number]>,
  x: number,
  y: number,
): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1] ?? [0, 0];
    const [bx, by] = points[i] ?? [0, 0];
    const lengthSq = (bx - ax) ** 2 + (by - ay) ** 2;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / lengthSq));
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return best;
}
