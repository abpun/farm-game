import type * as Phaser from 'phaser';
import type { BlockExpansion } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { EXTRA_TEXTURES } from '../art/ExtraArtist';
import { addArt, seededRandom } from '../art/paint';
import { PROP_TEXTURES } from '../art/PropArtist';
import type { IsoGrid } from '../iso/IsoGrid';
import { textStyle, TEXT } from '../theme';
import { formatMoney } from '../ui/format';

const OVERLAY_DEPTH = -1400;
const ROCK_LAYER = 1;
const TAG_DEPTH = 9400;
const ROCK_ORIGIN = { x: 0.5, y: 0.9 };
const ROCK_JITTER = 0.2;

export class LandView {
  private readonly sprites: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
  ) {
    session.bus.on('LandExpanded', () => this.refresh());
    session.bus.on('LevelUp', () => this.refresh());
    this.refresh();
  }

  private refresh(): void {
    this.sprites.splice(0).forEach((sprite) => sprite.destroy());
    const { farm, progression } = this.session;
    const blocks = farm.pendingBlocks();
    for (const block of blocks) {
      this.drawTiles(block);
      this.drawTag(block, progression.isUnlocked(block.unlockLevel) && farm.touchesOwned(block));
    }
    this.drawStones(blocks);
  }

  private drawTiles(block: BlockExpansion): void {
    for (let row = block.row; row < block.row + block.rows; row++) {
      for (let col = block.col; col < block.col + block.cols; col++) {
        const top = this.grid.tileTop(col, row);
        this.sprites.push(
          addArt(
            this.scene,
            top.x - this.grid.tileW / 2,
            top.y,
            EXTRA_TEXTURES.lockedTile,
          ).setDepth(OVERLAY_DEPTH),
        );
      }
    }
  }

  // One boulder per cell on the outer edge of the whole buildable grid: only where a pending
  // cell meets the wild beyond the world, never on the farm-facing side or between two plots
  // that are both still for sale, so the stones read as a single outer border, not a fill.
  private drawStones(blocks: readonly BlockExpansion[]): void {
    const { columns, rows } = this.session.world.size;
    const pending = new Set<string>();
    for (const b of blocks) {
      for (let row = b.row; row < b.row + b.rows; row++) {
        for (let col = b.col; col < b.col + b.cols; col++) pending.add(`${col},${row}`);
      }
    }
    const random = seededRandom(blocks.length * 97 + 11);
    for (const key of pending) {
      const [col, row] = key.split(',').map(Number) as [number, number];
      const onWorldEdge = col === 0 || row === 0 || col === columns - 1 || row === rows - 1;
      if (!onWorldEdge) continue;
      const center = this.grid.tileCenter(col, row);
      const jx = (random() - 0.5) * 2 * ROCK_JITTER * this.grid.tileW;
      const jy = (random() - 0.5) * 2 * ROCK_JITTER * this.grid.tileH;
      this.sprites.push(
        addArt(
          this.scene,
          center.x + jx,
          center.y + jy,
          PROP_TEXTURES.rock,
          ROCK_ORIGIN.x,
          ROCK_ORIGIN.y,
        ).setDepth(this.grid.depthOf(col, row) + ROCK_LAYER),
      );
    }
  }

  private drawTag(block: BlockExpansion, buyable: boolean): void {
    const center = this.grid.toScreen(block.col + block.cols / 2, block.row + block.rows / 2);
    const label = buyable ? `$${formatMoney(block.price)}` : `Lv ${block.unlockLevel}`;
    this.sprites.push(
      this.scene.add
        .text(center.x, center.y, label, textStyle(20, buyable ? TEXT.gold : TEXT.muted))
        .setOrigin(0.5)
        .setDepth(TAG_DEPTH),
    );
  }
}
