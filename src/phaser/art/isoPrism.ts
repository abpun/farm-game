import type * as Phaser from 'phaser';

/** Art pixels per grid step along a column (x right, y down) — half a 40×20 tile. */
export const ISO_STEP = { x: 20, y: 10 } as const;
/** How far (grid units) to probe when deciding which face a side pixel belongs to. */
const FACE_PROBE = 0.08;

export type Face = 'top' | 'west' | 'east';

export interface IsoCanvas {
  width: number;
  height: number;
  /** Texture pixel of grid point (0, 0) at ground level. */
  origin: { x: number; y: number };
}

export const isoPixel = (canvas: IsoCanvas, a: number, b: number, z = 0) => ({
  x: canvas.origin.x + (a - b) * ISO_STEP.x,
  y: canvas.origin.y + (a + b) * ISO_STEP.y - z,
});

const gridAt = (canvas: IsoCanvas, x: number, y: number, z: number) => {
  const dx = (x + 0.5 - canvas.origin.x) / ISO_STEP.x;
  const dy = (y + 0.5 + z - canvas.origin.y) / ISO_STEP.y;
  return { a: (dx + dy) / 2, b: (dy - dx) / 2 };
};

/**
 * Extrudes a footprint (in grid units a = along columns, b = along rows) from z0 to z1 art px.
 * Layers are drawn bottom-up, so the two faces toward the viewer show below the top.
 * `west` is the face toward +b (lit), `east` the face toward +a (shaded).
 */
export function fillPrism(
  g: Phaser.GameObjects.Graphics,
  canvas: IsoCanvas,
  inside: (a: number, b: number) => boolean,
  z0: number,
  z1: number,
  color: (face: Face, a: number, b: number, x: number, y: number, z: number) => number | null,
): void {
  for (let z = z0; z <= z1; z++) {
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const { a, b } = gridAt(canvas, x, y, z);
        if (!inside(a, b)) continue;
        const face: Face =
          z === z1
            ? 'top'
            : !inside(a, b + FACE_PROBE)
              ? 'west'
              : !inside(a + FACE_PROBE, b)
                ? 'east'
                : 'top';
        if (face === 'top' && z !== z1) continue;
        const value = color(face, a, b, x, y, z);
        if (value !== null) g.fillStyle(value).fillRect(x, y, 1, 1);
      }
    }
  }
}
