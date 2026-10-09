import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { BED_TEXTURES } from '../art/BedArtist';
import { addArt } from '../art/paint';
import type { IsoGrid } from '../iso/IsoGrid';
import type { Tool } from '../tools';
import { createItemImage } from './itemArt';
import type { WorldView } from './WorldView';

const CURSOR_DEPTH = 20000;
const GHOST_ALPHA = 0.7;
const TINT = { valid: 0xb6ff9e, invalid: 0xff8a80, neutral: 0xffffff } as const;

export interface Cell {
  col: number;
  row: number;
}

// Hover feedback: a tile outline, or a ghost of the item being built tinted by validity.
export class BuildCursor {
  private ghost: Phaser.GameObjects.Image | null = null;
  private readonly outlines: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
    private readonly world: WorldView,
  ) {}

  show(cell: Cell | null, tool: Tool): void {
    this.clear();
    if (!cell || !this.session.world.inBounds(cell.col, cell.row)) return;
    if (tool.kind === 'build') this.showGhost(cell, tool.itemId);
    else if (tool.kind === 'remove') this.showRemoval(cell);
    else this.outline([[cell.col, cell.row]], TINT.neutral);
  }

  private showGhost({ col, row }: Cell, itemId: string): void {
    const { catalog, world, economy } = this.session;
    const item = catalog.get(itemId);
    const valid = world.canPlace(itemId, col, row) && economy.canAfford(item.price);
    const tint = valid ? TINT.valid : TINT.invalid;
    const mask = item.kind === 'fence' ? this.world.fenceMask(col, row) : 0;
    const season = this.session.seasons.current().id;
    this.ghost = createItemImage(this.scene, this.grid, item, col, row, season, mask)
      .setAlpha(GHOST_ALPHA)
      .setTint(tint)
      .setDepth(CURSOR_DEPTH);
    this.outline(world.cellsFor(itemId, col, row), tint);
  }

  private showRemoval({ col, row }: Cell): void {
    const target = this.session.world.objectAt(col, row);
    if (!target) return;
    const removable = this.session.catalog.get(target.itemId).removable;
    const cells = this.session.world.cellsFor(target.itemId, target.col, target.row);
    this.outline(cells, removable ? TINT.invalid : TINT.neutral);
  }

  private outline(cells: Array<[number, number]>, tint: number): void {
    for (const [col, row] of cells) {
      const top = this.grid.tileTop(col, row);
      const image = addArt(this.scene, top.x - this.grid.tileW / 2, top.y, BED_TEXTURES.outline)
        .setTint(tint)
        .setDepth(CURSOR_DEPTH - 1);
      this.outlines.push(image);
    }
  }

  private clear(): void {
    this.ghost?.destroy();
    this.ghost = null;
    this.outlines.splice(0).forEach((image) => image.destroy());
  }
}
