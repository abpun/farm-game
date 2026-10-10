import { PixelBuffer } from '../PixelBuffer';

/** Five-step colour ramp, dark to light, hue-shifted (cool shadows, warm highlights). */
export type Ramp = readonly [number, number, number, number, number];
export const DEEP = 0;
export const SHADE = 1;
export const BASE = 2;
export const LIGHT = 3;
export const SHINE = 4;

const HUE_SHIFT = 0.035;
const RAMP_LIGHTNESS = [-0.3, -0.15, 0, 0.13, 0.26] as const;
const RAMP_SATURATION = [0.05, 0.04, 0, -0.04, -0.12] as const;
/** Light comes from the upper left and a little toward the viewer. */
const LIGHT_DIR = normalize(-0.55, -0.65, 0.55);
const OUTLINE_DARKEN = 0.45;
const SHADOW_COLOR = 0x2a1a10;
const SHADOW_ALPHA = 90;

export function ramp(color: number): Ramp {
  const [h, s, l] = toHsl(color);
  const step = (i: number) => {
    const shift = (i - BASE) * HUE_SHIFT;
    // Shadows lean toward blue (hue ~0.62), highlights toward yellow (~0.16).
    const target = i < BASE ? 0.62 : 0.16;
    const hue = h + Math.sign(target - h) * Math.min(Math.abs(target - h), Math.abs(shift));
    return fromHsl(hue, clamp(s + (RAMP_SATURATION[i] ?? 0)), clamp(l + (RAMP_LIGHTNESS[i] ?? 0)));
  };
  return [step(0), step(1), step(2), step(3), step(4)];
}

/** A drawing surface in art pixels with the shaping tools the crop painters share. */
export class Pixels {
  readonly buffer: PixelBuffer;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.buffer = new PixelBuffer(width, height);
  }

  set(x: number, y: number, color: number): void {
    this.buffer.set(Math.round(x), Math.round(y), color);
  }

  isSet(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return (this.buffer.data[(y * this.width + x) * 4 + 3] ?? 0) > 0;
  }

  colorAt(x: number, y: number): number {
    const i = (y * this.width + x) * 4;
    const d = this.buffer.data;
    return ((d[i] ?? 0) << 16) | ((d[i + 1] ?? 0) << 8) | (d[i + 2] ?? 0);
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, color);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: number | ((t: number) => number)) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.set(
        x0 + (x1 - x0) * t,
        y0 + (y1 - y0) * t,
        typeof color === 'number' ? color : color(t),
      );
    }
  }

  /** A shaded ellipsoid: each pixel's ramp step comes from its surface normal and the light. */
  ball(cx: number, cy: number, rx: number, ry: number, shades: Ramp, rim = true): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d);
        const lit = nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1] + nz * LIGHT_DIR[2];
        let step: number =
          lit > 0.82 ? SHINE : lit > 0.55 ? LIGHT : lit > 0.2 ? BASE : lit > -0.15 ? SHADE : DEEP;
        if (rim && d > 0.8 && step > SHADE && nx > 0.3) step = SHADE;
        this.set(x, y, shades[step] ?? shades[BASE]);
      }
    }
  }

  /**
   * A leaf from (x, y) toward angle (radians, 0 = right, -π/2 = up): a lens that widens to
   * `width` mid-way, lit on the upper side, with a midrib.
   */
  leaf(x: number, y: number, angle: number, length: number, width: number, shades: Ramp): void {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const px = -uy;
    const py = ux;
    for (let a = 0; a <= length; a += 0.5) {
      const t = a / length;
      const half = width * Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.5;
      for (let b = -half; b <= half; b += 0.5) {
        const upper = b * py < 0;
        const step = Math.abs(b) < 0.5 ? SHADE : upper ? LIGHT : BASE;
        this.set(x + ux * a + px * b, y + uy * a + py * b, shades[t > 0.85 ? LIGHT : step]);
      }
    }
  }

  /** Dark outline on the shadow side and below, lighter elsewhere (selective outline). */
  outline(): void {
    const marks: Array<[number, number, number]> = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isSet(x, y)) continue;
        const neighbours: Array<[number, number]> = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];
        const from = neighbours.find(([nx, ny]) => this.isSet(nx, ny));
        if (!from) continue;
        const [nx, ny] = from;
        const shadowSide = nx < x || ny < y;
        marks.push([x, y, darken(this.colorAt(nx, ny), shadowSide ? OUTLINE_DARKEN : 0.62)]);
      }
    }
    for (const [x, y, color] of marks) this.set(x, y, color);
  }

  /** A soft ground shadow (drawn after the outline so it is not outlined). */
  shadow(cx: number, cy: number, rx: number, alpha = SHADOW_ALPHA): void {
    for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
      for (const dy of [0, 1]) {
        if (this.isSet(Math.round(x), Math.round(cy + dy))) continue;
        if (dy === 1 && Math.abs(x - cx) > rx - 1) continue;
        this.buffer.set(Math.round(x), Math.round(cy + dy), SHADOW_COLOR, alpha);
      }
    }
  }

  /** Copies another surface onto this one at an offset, optionally mirrored. */
  stamp(source: Pixels, ox: number, oy: number, mirror = false): void {
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        const sx = mirror ? source.width - 1 - x : x;
        if (!source.isSet(sx, y)) continue;
        this.set(ox + x, oy + y, source.colorAt(sx, y));
      }
    }
  }
}

export const darken = (color: number, factor: number) =>
  (Math.round(((color >> 16) & 0xff) * factor) << 16) |
  (Math.round(((color >> 8) & 0xff) * factor) << 8) |
  Math.round((color & 0xff) * factor);

/** Deterministic noise in [0, 1) for scattering details. */
export function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function toHsl(color: number): [number, number, number] {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): number {
  const hue = ((h % 1) + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const k = ((t % 1) + 1) % 1;
    const v =
      k < 1 / 6
        ? p + (q - p) * 6 * k
        : k < 1 / 2
          ? q
          : k < 2 / 3
            ? p + (q - p) * (2 / 3 - k) * 6
            : p;
    return Math.round(v * 255);
  };
  return (channel(hue + 1 / 3) << 16) | (channel(hue) << 8) | channel(hue - 1 / 3);
}
