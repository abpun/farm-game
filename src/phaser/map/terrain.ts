/** Ground kinds of the tiled terrain; the order breaks ties when blending (later wins). */
export const TERRAINS = ['sea', 'sand', 'rock', 'grass', 'woods', 'path', 'fresh'] as const;
export type Terrain = (typeof TERRAINS)[number];
export type TerrainCode = number;

export const CODE: Record<Terrain, TerrainCode> = {
  sea: 0,
  sand: 1,
  rock: 2,
  grass: 3,
  woods: 4,
  path: 5,
  fresh: 6,
};

/** Corner terrain of a tile, clockwise from the top: N, E, S, W. */
export type Corners = readonly [TerrainCode, TerrainCode, TerrainCode, TerrainCode];

export interface Blend {
  top: TerrainCode;
  second: TerrainCode;
  /** How far `top` leads `second` (0 on an edge, 1 deep inside one terrain). */
  margin: number;
  /** Total weight of each terrain at the point, indexed by code. */
  weights: Float32Array;
}

const weights = new Float32Array(TERRAINS.length);
const scored = new Float32Array(TERRAINS.length);

/**
 * Bilinear blend of the four corners at (a, b) inside a tile: a runs N→E, b runs N→W.
 * `jitter(code)` nudges each score so edges come out dithered rather than ruled.
 */
export function blendCorners(
  corners: Corners,
  a: number,
  b: number,
  jitter?: (code: TerrainCode) => number,
): Blend {
  weights.fill(0);
  const [n, e, s, w] = corners;
  weights[n] = (1 - a) * (1 - b);
  weights[e] = read(weights, e) + a * (1 - b);
  weights[s] = read(weights, s) + a * b;
  weights[w] = read(weights, w) + (1 - a) * b;
  for (const code of corners) scored[code] = read(weights, code) + (jitter ? jitter(code) : 0);
  let top = corners[0];
  let second = -1;
  for (const code of corners) {
    if (code === top || code === second) continue;
    if (beats(code, top)) {
      second = top;
      top = code;
    } else if (second < 0 || beats(code, second)) second = code;
  }
  const margin = second < 0 ? 1 : read(scored, top) - read(scored, second);
  return { top, second: second < 0 ? top : second, margin, weights };
}

const read = (values: Float32Array, code: TerrainCode) => values[code] ?? 0;

const beats = (code: TerrainCode, other: TerrainCode) => {
  const a = read(scored, code);
  const b = read(scored, other);
  return a > b || (a === b && code > other);
};

export const signature = (corners: Corners, variant: number) => `${corners.join('')}:${variant}`;

export const isUniform = (corners: Corners) =>
  corners[0] === corners[1] && corners[1] === corners[2] && corners[2] === corners[3];
