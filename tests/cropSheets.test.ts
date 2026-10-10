import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cropSheetSpec, paintCropSheet } from '@game/art/crops/cropSheet';
import { config } from './helpers';

const alphaAt = (data: Uint8ClampedArray, width: number, x: number, y: number) =>
  data[(y * width + x) * 4 + 3] ?? 0;

describe('crop sheets', () => {
  it('ships a PNG per crop: one icon frame plus one per growth stage', () => {
    for (const crop of config.crops) {
      const spec = cropSheetSpec(crop);
      const png = readFileSync(`public/assets/crops/${crop.id}.png`);
      expect(png.readUInt32BE(16), crop.id).toBe(spec.frame.w * (crop.stages + 1));
      expect(png.readUInt32BE(20), crop.id).toBe(spec.frame.h);
    }
  });

  it('paints every frame of every crop, rooted at the frame ground point', () => {
    for (const crop of config.crops) {
      const spec = cropSheetSpec(crop);
      const sheet = paintCropSheet(crop);
      for (let frame = 0; frame <= crop.stages; frame++) {
        let opaque = 0;
        for (let y = 0; y < spec.frame.h; y++) {
          for (let x = 0; x < spec.frame.w; x++) {
            if (alphaAt(sheet.data, sheet.width, frame * spec.frame.w + x, y) > 0) opaque++;
          }
        }
        expect(opaque, `${crop.id} frame ${frame}`).toBeGreaterThan(10);
      }
      const ripe = crop.stages * spec.frame.w + spec.ground.x;
      const nearGround = [-1, 0, 1].some(
        (dx) => alphaAt(sheet.data, sheet.width, ripe + dx, spec.ground.y - 1) > 0,
      );
      expect(nearGround, `${crop.id} grows from its ground point`).toBe(true);
    }
  });
});
