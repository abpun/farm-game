import type { Point } from '../iso/IsoGrid';

export const lerpPoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const up = (p: Point, height: number): Point => ({ x: p.x, y: p.y - height });

export const shift = (p: Point, dx: number, dy: number): Point => ({ x: p.x + dx, y: p.y + dy });

export const flat = (...points: Point[]): number[] => points.flatMap((p) => [p.x, p.y]);

// Quad on a vertical wall running p0→p1: u is along the wall, h is height above ground.
export const wallQuad = (
  p0: Point,
  p1: Point,
  u0: number,
  u1: number,
  h0: number,
  h1: number,
): number[] => {
  const a = lerpPoint(p0, p1, u0);
  const b = lerpPoint(p0, p1, u1);
  return flat(up(a, h0), up(b, h0), up(b, h1), up(a, h1));
};
