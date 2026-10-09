import type * as Phaser from 'phaser';
import type { PlacedObject } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { FENCE_LINK, fenceTextureKey } from '../art/FenceArtist';
import { PlotView } from '../components/PlotView';
import type { IsoGrid } from '../iso/IsoGrid';
import { BuildingView } from './BuildingView';
import { createItemImage, itemDepth, itemTexture } from './itemArt';

const NEIGHBOURS: Array<[dc: number, dr: number, bit: number]> = [
  [0, -1, FENCE_LINK.north],
  [1, 0, FENCE_LINK.east],
  [0, 1, FENCE_LINK.south],
  [-1, 0, FENCE_LINK.west],
];

// Mirrors the core world: one sprite per placed object, kept in sync through bus events.
export class WorldView {
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly plotViews = new Map<number, PlotView>();
  private readonly buildingViews = new Map<number, BuildingView>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
  ) {
    for (const object of session.world.objects()) this.add(object);
    session.bus.on('ObjectPlaced', ({ object }) => {
      this.add(object);
      this.refreshFencesAround(object);
    });
    session.bus.on('ObjectRemoved', ({ object }) => {
      this.remove(object.id);
      this.refreshFencesAround(object);
    });
    session.bus.on('PlotUpdated', ({ plotId }) => this.plotViews.get(plotId)?.refresh());
    session.bus.on('SeasonChanged', ({ seasonId }) => this.applySeason(seasonId));
  }

  private applySeason(seasonId: string): void {
    for (const object of this.session.world.objects()) {
      const item = this.session.catalog.get(object.itemId);
      if (item.kind === 'fence' || item.kind === 'plot') continue;
      this.sprites.get(object.id)?.setTexture(itemTexture(this.scene, item, seasonId));
    }
  }

  update(): void {
    this.plotViews.forEach((view) => view.refresh());
    this.buildingViews.forEach((view) => view.refresh());
  }

  sprite(objectId: number): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(objectId);
  }

  plotView(plotId: number): PlotView | undefined {
    return this.plotViews.get(plotId);
  }

  fenceMask(col: number, row: number): number {
    return NEIGHBOURS.reduce((mask, [dc, dr, bit]) => {
      const neighbour = this.session.world.objectAt(col + dc, row + dr);
      return neighbour && this.isFence(neighbour) ? mask | bit : mask;
    }, 0);
  }

  private add(object: PlacedObject): void {
    const item = this.session.catalog.get(object.itemId);
    const mask = item.kind === 'fence' ? this.fenceMask(object.col, object.row) : 0;
    const sprite = createItemImage(
      this.scene,
      this.grid,
      item,
      object.col,
      object.row,
      this.session.seasons.current().id,
      mask,
    );
    this.sprites.set(object.id, sprite);
    if (this.session.buildings.isBuilding(object.id)) {
      const view = new BuildingView(this.scene, this.session, this.grid, object, item, sprite);
      this.buildingViews.set(object.id, view);
    }
    if (item.kind !== 'plot') return;
    const depth = itemDepth(this.grid, item, object.col, object.row);
    const view = new PlotView(
      this.scene,
      this.session,
      this.grid,
      object.id,
      object.col,
      object.row,
      depth,
    );
    this.plotViews.set(object.id, view);
  }

  private remove(objectId: number): void {
    this.sprites.get(objectId)?.destroy();
    this.sprites.delete(objectId);
    this.plotViews.get(objectId)?.destroy();
    this.plotViews.delete(objectId);
    this.buildingViews.get(objectId)?.destroy();
    this.buildingViews.delete(objectId);
  }

  private refreshFencesAround(origin: PlacedObject): void {
    for (const [dc, dr] of NEIGHBOURS) {
      const neighbour = this.session.world.objectAt(origin.col + dc, origin.row + dr);
      if (!neighbour || !this.isFence(neighbour)) continue;
      const mask = this.fenceMask(neighbour.col, neighbour.row);
      this.sprites.get(neighbour.id)?.setTexture(fenceTextureKey(mask));
    }
  }

  private isFence(object: PlacedObject): boolean {
    return this.session.catalog.get(object.itemId).kind === 'fence';
  }
}
