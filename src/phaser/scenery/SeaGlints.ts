import type * as Phaser from 'phaser';
import { addArt, bake, seededRandom } from '../art/paint';
import { TERRAIN_DEPTH, type Bounds } from '../art/TerrainArtist';
import { PIXEL_SCALE } from '../layout';
import { PALETTE } from '../theme';

const GLINT_KEY = 'ground-glint';

// Twinkling highlights on water, re-seated somewhere new each time they fade out.
export function placeGlints(
  scene: Phaser.Scene,
  area: Bounds,
  count: number,
  isOpenWater: (x: number, y: number) => boolean,
  depth: number = TERRAIN_DEPTH.glints,
): void {
  bake(scene, GLINT_KEY, 3, 1, (g) => g.fillStyle(PALETTE.foam).fillRect(0, 0, 3, 1));
  const random = seededRandom(19 + count);
  const snap = (value: number) => Math.round(value / PIXEL_SCALE) * PIXEL_SCALE;
  const reseat = (glint: Phaser.GameObjects.Image) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = area.x + random() * area.width;
      const y = area.y + random() * area.height;
      if (!isOpenWater(x, y)) continue;
      glint.setPosition(snap(x), snap(y)).setVisible(true);
      return;
    }
    glint.setVisible(false);
  };
  for (let i = 0; i < count; i++) {
    const glint = addArt(scene, 0, 0, GLINT_KEY).setDepth(depth).setAlpha(0);
    reseat(glint);
    scene.tweens.add({
      targets: glint,
      alpha: 0.85,
      duration: 700 + random() * 600,
      delay: random() * 4000,
      hold: 200,
      yoyo: true,
      repeat: -1,
      repeatDelay: 1500 + random() * 3000,
      onRepeat: () => reseat(glint),
    });
  }
}
