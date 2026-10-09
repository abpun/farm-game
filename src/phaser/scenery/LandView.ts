import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { EXTRA_TEXTURES } from '../art/ExtraArtist';
import { addArt } from '../art/paint';
import type { IsoGrid } from '../iso/IsoGrid';
import { textStyle, TEXT } from '../theme';
import { formatMoney } from '../ui/format';

// Above the island, below anything placed on it.
const OVERLAY_DEPTH = -1400;
const SIGN_DEPTH = 9500;

// Dims the tiles the player has not bought yet and labels the next plot of land for sale.
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
    // Only the next plot for sale is marked; land beyond it is plain meadow.
    const limit = farm.nextExpansion()?.size ?? 0;
    for (let row = 0; row < Math.min(limit, world.size.rows); row++) {
      for (let col = 0; col < Math.min(limit, world.size.columns); col++) {
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
    this.sign.setVisible(Boolean(next));
    if (!next) return;
    const size = this.session.state.landSize;
    const at = this.grid.toScreen(size + (next.size - size) / 2, size + (next.size - size) / 2);
    this.sign
      .setPosition(at.x, at.y)
      .setText(`Land for sale · $${formatMoney(next.price)} · Lv ${next.unlockLevel}`);
  }
}
