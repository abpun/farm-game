import * as Phaser from 'phaser';
import { PIXEL_SCALE } from '../layout';

export const SHADOW = { color: 0x000000, alpha: 0.4 } as const;
const SHADOW_ALPHA = Math.round(SHADOW.alpha * 255);
const SHADOW_ALPHA_MIN = 40;
const SHADOW_RGB_MAX = 40;
const SOLID_ALPHA_MIN = 128;

export const hex = (value: string): number => Phaser.Display.Color.HexStringToColor(value).color;

export function shade(color: number, factor: number): number {
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((color >> shift) & 0xff) * factor)));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export const lineWidth = (width: number): number => Math.max(1, Math.round(width));

export function fillPoly(g: Phaser.GameObjects.Graphics, points: number[]): void {
  tracePoly(g, points);
  g.fillPath();
}

export function strokePoly(g: Phaser.GameObjects.Graphics, points: number[]): void {
  tracePoly(g, points);
  g.strokePath();
}

function tracePoly(g: Phaser.GameObjects.Graphics, points: number[]): void {
  g.beginPath();
  g.moveTo(points[0] ?? 0, points[1] ?? 0);
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
  g.closePath();
}

export function bake(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, Math.ceil(width), Math.ceil(height));
  g.destroy();
  snapToPixels(scene.textures.get(key) as Phaser.Textures.CanvasTexture);
}

// Strips anti-aliasing: pixels become opaque, transparent, or a fixed-alpha black shadow.
function snapToPixels(texture: Phaser.Textures.CanvasTexture): void {
  const ctx = texture.getContext();
  const image = ctx.getImageData(0, 0, texture.width, texture.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha >= SOLID_ALPHA_MIN) {
      data[i + 3] = 255;
      continue;
    }
    const isShadow = [0, 1, 2].every((c) => (data[i + c] ?? 255) < SHADOW_RGB_MAX);
    data[i + 3] = isShadow && alpha >= SHADOW_ALPHA_MIN ? SHADOW_ALPHA : 0;
  }
  ctx.putImageData(image, 0, 0);
  texture.refresh();
}

export function addArt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  originX = 0,
  originY = 0,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setOrigin(originX, originY).setScale(PIXEL_SCALE);
}

// Deterministic pseudo-random so decorations stay put between reloads.
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
