import type * as Phaser from 'phaser';
import type { PlacedObject } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { PlotView } from '../components/PlotView';
import type { IsoGrid } from '../iso/IsoGrid';
import { BuildingView } from './BuildingView';
import { createFenceView, createItemImage, itemDepth, itemTexture } from './itemArt';

const LIFTED_ALPHA = 0.35;
interface GridCell {
  col: number;
  row: number;
}
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// Mirrors the core world: one sprite per placed object, kept in sync through bus events.
// Fences are the exception: each is a little container assembled from a centre post plus the
// rail halves that point at neighbouring fences, so runs join up and turn corners.
export class WorldView {
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly fenceViews = new Map<number, Phaser.GameObjects.Container>();
  /** Real fences currently showing a build-ghost connection, to restore when the ghost clears. */
  private readonly previewedFences = new Set<number>();
  private readonly plotViews = new Map<number, PlotView>();
  private readonly buildingViews = new Map<number, BuildingView>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
  ) {
    for (const object of session.world.objects()) this.add(object);
    // All objects are placed now, so each fence can see its neighbours and connect to them.
    for (const object of session.world.objects()) {
      if (this.isFence(object.itemId)) this.rebuildFence(object);
    }
    session.bus.on('ObjectPlaced', ({ object }) => {
      this.add(object);
      this.refreshFenceNeighbors(object);
    });
    session.bus.on('ObjectRemoved', ({ object }) => {
      this.remove(object.id);
      this.refreshFenceNeighbors(object);
    });
    session.bus.on('ObjectMoved', ({ object, from }) => {
      this.remove(object.id);
      this.add(object);
      if (from) this.refreshFenceNeighbors(from);
      this.refreshFenceNeighbors(object);
    });
    session.bus.on('PlotUpdated', ({ plotId }) => this.plotViews.get(plotId)?.refresh());
    session.bus.on('SeasonChanged', ({ seasonId }) => this.applySeason(seasonId));
  }

  private applySeason(seasonId: string): void {
    for (const object of this.session.world.objects()) {
      const item = this.session.catalog.get(object.itemId);
      if (item.kind === 'plot') continue;
      if (item.kind === 'fence') {
        this.rebuildFence(object);
        continue;
      }
      this.sprites.get(object.id)?.setTexture(itemTexture(this.scene, item, seasonId));
    }
  }

  private isFence(itemId: string): boolean {
    return this.session.catalog.get(itemId).kind === 'fence';
  }

  /**
   * Builds (or rebuilds) a fence from the rail halves that face its neighbouring fences.
   * `phantom` is an extra cell treated as if it held a fence — used so neighbours grow a rail
   * toward the build ghost before it is actually placed.
   */
  private rebuildFence(object: PlacedObject, phantom?: GridCell): void {
    this.fenceViews.get(object.id)?.destroy();
    const item = this.session.catalog.get(object.itemId);
    const seasonId = this.session.seasons.current().id;
    const container = createFenceView(this.scene, this.grid, item, object, seasonId, (col, row) =>
      this.fenceAt(col, row, phantom),
    );
    this.fenceViews.set(object.id, container);
  }

  private fenceAt(col: number, row: number, phantom?: GridCell): boolean {
    if (phantom && phantom.col === col && phantom.row === row) return true;
    const object = this.session.world.objectAt(col, row);
    return object !== undefined && this.isFence(object.itemId);
  }

  /** Grows a connecting rail on the real fences around `cell`, as if one were placed there. */
  previewFenceAt(cell: GridCell): void {
    this.clearFencePreview();
    for (const [dc, dr] of NEIGHBORS) {
      const neighbor = this.session.world.objectAt(cell.col + dc, cell.row + dr);
      if (neighbor && this.isFence(neighbor.itemId)) {
        this.rebuildFence(neighbor, cell);
        this.previewedFences.add(neighbor.id);
      }
    }
  }

  /** Restores any fences that were showing a build-ghost connection to their real state. */
  clearFencePreview(): void {
    for (const id of this.previewedFences) {
      const object = this.session.world.get(id);
      if (object) this.rebuildFence(object);
    }
    this.previewedFences.clear();
  }

  // A fence changing joins or frees its neighbours, so rebuild them too.
  private refreshFenceNeighbors(object: PlacedObject): void {
    if (!this.isFence(object.itemId)) return;
    for (const [dc, dr] of NEIGHBORS) {
      const neighbor = this.session.world.objectAt(object.col + dc, object.row + dr);
      if (neighbor && this.isFence(neighbor.itemId)) this.rebuildFence(neighbor);
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
    for (const [id, fence] of this.fenceViews) fence.setAlpha(id === objectId ? LIFTED_ALPHA : 1);
  }

  private add(object: PlacedObject): void {
    const item = this.session.catalog.get(object.itemId);
    if (item.kind === 'fence') {
      this.rebuildFence(object);
      return;
    }
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
    this.fenceViews.get(objectId)?.destroy();
    this.fenceViews.delete(objectId);
    this.plotViews.get(objectId)?.destroy();
    this.plotViews.delete(objectId);
    this.buildingViews.get(objectId)?.destroy();
    this.buildingViews.delete(objectId);
  }
}
