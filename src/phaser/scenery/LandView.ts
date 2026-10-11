import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { EXTRA_TEXTURES } from '../art/ExtraArtist';
import { addArt } from '../art/paint';
import type { IsoGrid } from '../iso/IsoGrid';
import { textStyle, TEXT } from '../theme';
import { formatMoney } from '../ui/format';

const OVERLAY_DEPTH = -1400;
const SIGN_DEPTH = 9500;
const BORDER = 4;

export class LandView {
  private readonly tiles: Phaser.GameObjects.Image[] = [];
  private readonly sign: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
  ) {
    this.sign = scene.add
      .text(0, 0, '', textStyle(22, TEXT.gold))
      .setOrigin(0.5)
      .setDepth(SIGN_DEPTH);
    session.bus.on('LandExpanded', () => this.refresh());
    session.bus.on('LevelUp', () => this.refresh());
    this.refresh();
  }

  private refresh(): void {
    this.tiles.splice(0).forEach((tile) => tile.destroy());
    const { world, farm } = this.session;
    const blocks = this.session.state.ownedBlocks;
    let minCol = world.size.columns;
    let minRow = world.size.rows;
    let maxCol = 0;
    let maxRow = 0;
    for (const b of blocks) {
      minCol = Math.min(minCol, b.col);
      minRow = Math.min(minRow, b.row);
      maxCol = Math.max(maxCol, b.col + b.cols);
      maxRow = Math.max(maxRow, b.row + b.rows);
    }
    const r0 = Math.max(0, minRow - BORDER);
    const r1 = Math.min(world.size.rows, maxRow + BORDER);
    const c0 = Math.max(0, minCol - BORDER);
    const c1 = Math.min(world.size.columns, maxCol + BORDER);
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) {
        if (world.isOwned(col, row)) continue;
        const top = this.grid.tileTop(col, row);
        this.tiles.push(
          addArt(
            this.scene,
            top.x - this.grid.tileW / 2,
            top.y,
            EXTRA_TEXTURES.lockedTile,
          ).setDepth(OVERLAY_DEPTH),
        );
      }
    }
    const next = farm.nextExpansion();
    const cheapestBlock = farm.availableBlocks()[0];
    if (next || cheapestBlock) {
      const price = cheapestBlock?.price ?? next?.price ?? 0;
      const cx = (c0 + c1) / 2;
      const cy = (r0 + r1) / 2;
      const at = this.grid.toScreen(cx, cy);
      this.sign
        .setPosition(at.x, at.y)
        .setText(`Land for sale · from $${formatMoney(price)}`)
        .setVisible(true);
    } else {
      this.sign.setVisible(false);
    }
  }
}
