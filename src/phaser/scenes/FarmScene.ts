import * as Phaser from 'phaser';
import { playCue } from '../audio/playCue';
import { floatText } from '../components/floatingText';
import { WorldFx } from '../fx/WorldFx';
import { createFarmGrid } from '../iso/createFarmGrid';
import type { IsoGrid } from '../iso/IsoGrid';
import { AutosaveManager } from '../managers/AutosaveManager';
import { CameraManager, paddedBounds } from '../managers/CameraManager';
import { createIslandShape, FarmScenery, islandExtent, sceneryFocus } from '../scenery/FarmScenery';
import { FishingSpots } from '../scenery/FishingSpots';
import { LandView } from '../scenery/LandView';
import { getSession, getTools, getUiBus } from '../session';
import { TEXT } from '../theme';
import { BuildCursor, type Cell } from '../world/BuildCursor';
import { WorldView } from '../world/WorldView';
import { formatDuration } from '../ui/format';

const MS_PER_SEC = 1000;
const CONFIRM_MS = 2500;

type Say = (message: string, color: string) => void;

export class FarmScene extends Phaser.Scene {
  private grid!: IsoGrid;
  private world!: WorldView;
  private scenery!: FarmScenery;
  private cursor!: BuildCursor;
  private cameraControl!: CameraManager;
  private fishingSpots!: FishingSpots;
  private fx!: WorldFx;
  private hoveredCell: Cell | null = null;
  /** A planted plot the remove tool was tapped on once; a second tap digs it up. */
  private pendingDig: { plotId: number; until: number } | null = null;

  constructor() {
    super('Farm');
  }

  create(): void {
    const session = getSession(this);
    const tools = getTools(this);
    this.grid = createFarmGrid(session);
    const shape = createIslandShape(this.grid, session.config.farm.paths);
    const island = islandExtent(this.grid, shape);
    const season = session.seasons.current().id;
    this.scenery = new FarmScenery(this, this.grid, shape, paddedBounds(island), season);
    session.bus.on('SeasonChanged', ({ seasonId }) => this.scenery.setSeason(seasonId));
    new LandView(this, session, this.grid);
    this.fishingSpots = new FishingSpots(this, session, this.grid, shape);
    this.world = new WorldView(this, session, this.grid);
    this.cursor = new BuildCursor(this, session, this.grid, this.world);
    this.fx = new WorldFx(this, session, this.grid, this.world, this.fishingSpots);
    this.cameraControl = new CameraManager(this, island, sceneryFocus(this.grid));
    new AutosaveManager(this, session);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.hover(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonReleased()) tools.clear();
      else if (!this.cameraControl.isDragging) this.tap(pointer);
    });
    this.input.keyboard?.on('keydown-ESC', () => tools.clear());
    this.input.mouse?.disableContextMenu();
    tools.bus.on('ToolChanged', ({ tool }) => this.cursor.show(this.hoveredCell, tool));
    session.bus.on('MoneyChanged', () => this.cursor.show(this.hoveredCell, tools.tool));
    session.bus.on('CropHarvested', ({ plotId, cropId, amount, xp }) => {
      const view = this.world.plotView(plotId);
      if (!view) return;
      const { x, y } = view.center();
      floatText(this, x, y, `+${amount} ${session.crops.get(cropId).name}`, TEXT.success);
      floatText(this, x, y + 22, `+${xp} xp`, TEXT.gold);
    });
  }

  override update(_time: number, deltaMs: number): void {
    getSession(this).update(deltaMs / MS_PER_SEC);
    this.world.update();
    this.fishingSpots.update();
    this.scenery.update(deltaMs / MS_PER_SEC);
    this.fx.update(deltaMs);
  }

  private cellAt(pointer: Phaser.Input.Pointer): Cell {
    return this.grid.cellAt(pointer.worldX, pointer.worldY);
  }

  private hover(pointer: Phaser.Input.Pointer): void {
    const cell = this.cellAt(pointer);
    if (this.hoveredCell?.col === cell.col && this.hoveredCell.row === cell.row) return;
    this.setPlotHover(this.hoveredCell, false);
    this.hoveredCell = cell;
    this.setPlotHover(cell, true);
    this.cursor.show(cell, getTools(this).tool);
  }

  private setPlotHover(cell: Cell | null, hovered: boolean): void {
    if (!cell) return;
    const object = getSession(this).world.objectAt(cell.col, cell.row);
    if (object) this.world.plotView(object.id)?.setHovered(hovered);
  }

  private tap(pointer: Phaser.Input.Pointer): void {
    const session = getSession(this);
    const tool = getTools(this).tool;
    const cell = this.cellAt(pointer);
    const say: Say = (message, color) => {
      const { x, y } = this.grid.tileCenter(cell.col, cell.row);
      floatText(this, x, y, message, color);
      if (color !== TEXT.error) return;
      playCue(this, 'error');
      getUiBus(this).emit('Denied', { reason: message });
    };

    if (!session.world.inBounds(cell.col, cell.row)) {
      const exact = this.grid.toGrid(pointer.worldX, pointer.worldY);
      const spotId = this.fishingSpots.spotAt(exact.col, exact.row);
      if (spotId && tool.kind === 'none') getUiBus(this).emit('OpenFishing', { spotId });
      return;
    }
    if (tool.kind === 'build') {
      const result = session.farm.build(tool.itemId, cell.col, cell.row);
      if (!result.ok) say(result.reason, TEXT.error);
      this.cursor.show(cell, tool);
      return;
    }
    const target = session.world.objectAt(cell.col, cell.row);
    if (tool.kind === 'remove') {
      if (target) this.remove(target.id, say);
      this.cursor.show(cell, tool);
      return;
    }
    if (!session.world.isOwned(cell.col, cell.row)) {
      if (tool.kind === 'none') getUiBus(this).emit('OpenLand', {});
      return;
    }
    if (!target) return;
    if (session.buildings.isBuilding(target.id)) {
      getUiBus(this).emit('OpenBuilding', { objectId: target.id });
      return;
    }
    if (!session.plots.isPlot(target.id)) return;
    this.tapPlot(target.id, tool.kind === 'plant' ? tool.cropId : null, say);
  }

  private remove(objectId: number, say: Say): void {
    const { farm, plots } = getSession(this);
    const planted = plots.isPlot(objectId) && !plots.isEmpty(objectId);
    if (planted) {
      const confirmed =
        this.pendingDig?.plotId === objectId && this.time.now < this.pendingDig.until;
      if (!confirmed) {
        this.pendingDig = { plotId: objectId, until: this.time.now + CONFIRM_MS };
        say('Tap again to dig it up', TEXT.gold);
        return;
      }
      this.pendingDig = null;
      farm.clearPlot(objectId);
      say('Dug up', TEXT.muted);
      return;
    }
    const result = farm.demolish(objectId);
    say(result.ok ? 'Removed' : result.reason, result.ok ? TEXT.muted : TEXT.error);
  }

  // Ready: harvest. Growing: water once, then show time left. Empty: plant the armed seed.
  private tapPlot(plotId: number, seed: string | null, say: Say): void {
    const { farm, plots, crops } = getSession(this);
    if (plots.isReady(plotId)) {
      const result = farm.harvest(plotId);
      if (!result.ok) say(result.reason, TEXT.error);
      return;
    }
    const growing = plots.cropOf(plotId);
    if (growing) {
      const watered = farm.water(plotId).ok;
      const remaining = plots.secondsRemaining(plotId);
      const when = Number.isFinite(remaining) ? formatDuration(remaining) : 'dormant this season';
      const prefix = watered ? 'Watered! ' : '';
      say(`${prefix}${crops.plantName(growing)}: ${when}`, watered ? TEXT.success : TEXT.base);
      return;
    }
    if (!seed) {
      say('Pick a seed in the Market', TEXT.muted);
      return;
    }
    const result = farm.plant(plotId, seed);
    if (!result.ok) say(result.reason, TEXT.error);
  }
}
