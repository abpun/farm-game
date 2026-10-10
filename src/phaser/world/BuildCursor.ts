import type * as Phaser from 'phaser';
import type { CatalogItem } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import type { Spot } from '@core/systems/WorldSystem';
import { BED_TEXTURES } from '../art/BedArtist';
import { addArt } from '../art/paint';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import type { Tool } from '../tools';
import { createItemImage } from './itemArt';
import { pickObject, spotUnder, type GridPoint } from './spots';

const CURSOR_DEPTH = 20000;
const GHOST_ALPHA = 0.7;
const EDGE_LINE = PIXEL_SCALE;
const TINT = { valid: 0xb6ff9e, invalid: 0xff8a80, neutral: 0xffffff } as const;

export interface Cell {
  col: number;
  row: number;
}

// Hover feedback: a tile outline, or a ghost of the item being built or moved, tinted by
// whether it fits. Edge items snap to the nearest tile edge.
export class BuildCursor {
  private ghost: Phaser.GameObjects.Image | null = null;
  private readonly outlines: Phaser.GameObjects.Image[] = [];
  private readonly edgeLine: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
  ) {
    this.edgeLine = scene.add.graphics().setDepth(CURSOR_DEPTH - 1);
  }

  show(point: GridPoint | null, tool: Tool): void {
    this.clear();
    if (!point) return;
    const cell = { col: Math.floor(point.col), row: Math.floor(point.row) };
    const { world, catalog, economy } = this.session;
    if (tool.kind === 'build') {
      const item = catalog.get(tool.itemId);
      const spot = spotUnder(point, world.isEdgeItem(item.id));
      const valid = world.canPlace(item.id, spot) && economy.canAfford(item.price);
      this.showGhost(item, spot, valid);
      return;
    }
    if (tool.kind === 'move' && tool.objectId !== null) {
      const object = world.get(tool.objectId);
      if (!object) return;
      const item = catalog.get(object.itemId);
      const spot = spotUnder(point, world.isEdgeItem(item.id), tool.rotated);
      this.showGhost(item, spot, world.canMove(object.id, spot));
      return;
    }
    if (tool.kind === 'move' || tool.kind === 'remove') {
      this.showTarget(point, tool.kind === 'remove');
      return;
    }
    if (world.inBounds(cell.col, cell.row)) this.outline([[cell.col, cell.row]], TINT.neutral);
  }

  private showGhost(item: CatalogItem, spot: Spot, valid: boolean): void {
    const tint = valid ? TINT.valid : TINT.invalid;
    const season = this.session.seasons.current().id;
    this.ghost = createItemImage(this.scene, this.grid, item, spot, season)
      .setAlpha(GHOST_ALPHA)
      .setTint(tint)
      .setDepth(CURSOR_DEPTH);
    if (spot.edge) this.drawEdge(spot, tint);
    else this.outline(this.session.world.cellsFor(item.id, spot.col, spot.row, spot.rotated), tint);
  }

  private showTarget(point: GridPoint, removing: boolean): void {
    const { world, catalog } = this.session;
    const target = pickObject(world, point);
    if (!target) return;
    const tint = !removing
      ? TINT.valid
      : catalog.get(target.itemId).removable
        ? TINT.invalid
        : TINT.neutral;
    if (target.edge) this.drawEdge(target, tint);
    else this.outline(world.cellsOf(target), tint);
  }

  private drawEdge(spot: Spot, tint: number): void {
    const from = this.grid.toScreen(spot.col, spot.row);
    const to =
      spot.edge === 'w'
        ? this.grid.toScreen(spot.col, spot.row + 1)
        : this.grid.toScreen(spot.col + 1, spot.row);
    this.edgeLine.lineStyle(EDGE_LINE, tint).lineBetween(from.x, from.y, to.x, to.y);
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
    this.edgeLine.clear();
    this.outlines.splice(0).forEach((image) => image.destroy());
  }
}
