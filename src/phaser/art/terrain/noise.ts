export interface Noise {
  /** Deterministic hash of an integer lattice point, in [0, 1). */
  hash(x: number, y: number): number;
  /** Smooth value noise in [0, 1]. */
  value(x: number, y: number): number;
  /** Fractal (layered) value noise in [0, 1]. */
  fbm(x: number, y: number, octaves?: number): number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function createNoise(seed: number): Noise {
  const hash = (x: number, y: number) => {
    let h =
      (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  const value = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  const fbm = (x: number, y: number, octaves = 3) => {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amplitude * value(x * frequency, y * frequency);
      total += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return sum / total;
  };

  return { hash, value, fbm };
}

// 4×4 Bayer matrix, normalised to (0, 1): used to dither between neighbouring palette tones.
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number): number =>
  ((BAYER_4[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
