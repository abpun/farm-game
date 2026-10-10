import type * as Phaser from 'phaser';
import type { PlacedObject } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { PlotView } from '../components/PlotView';
import type { IsoGrid } from '../iso/IsoGrid';
import { BuildingView } from './BuildingView';
import { createItemImage, itemDepth, itemTexture } from './itemArt';

const LIFTED_ALPHA = 0.35;

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
    session.bus.on('ObjectPlaced', ({ object }) => this.add(object));
    session.bus.on('ObjectRemoved', ({ object }) => this.remove(object.id));
    session.bus.on('ObjectMoved', ({ object }) => {
      this.remove(object.id);
      this.add(object);
    });
    session.bus.on('PlotUpdated', ({ plotId }) => this.plotViews.get(plotId)?.refresh());
    session.bus.on('SeasonChanged', ({ seasonId }) => this.applySeason(seasonId));
  }

  private applySeason(seasonId: string): void {
    for (const object of this.session.world.objects()) {
      const item = this.session.catalog.get(object.itemId);
      if (item.kind === 'plot') continue;
      this.sprites.get(object.id)?.setTexture(itemTexture(this.scene, item, seasonId, object));
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

  /** Fades an object while it is picked up to be moved. */
  setLifted(objectId: number | null): void {
    for (const [id, sprite] of this.sprites) sprite.setAlpha(id === objectId ? LIFTED_ALPHA : 1);
  }

  private add(object: PlacedObject): void {
    const item = this.session.catalog.get(object.itemId);
    const season = this.session.seasons.current().id;
    const sprite = createItemImage(this.scene, this.grid, item, object, season);
    this.sprites.set(object.id, sprite);
    if (this.session.buildings.isBuilding(object.id)) {
      const view = new BuildingView(this.scene, this.session, this.grid, object, item, sprite);
      this.buildingViews.set(object.id, view);
    }
    if (item.kind !== 'plot') return;
    const depth = itemDepth(this.grid, item, object);
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
}
