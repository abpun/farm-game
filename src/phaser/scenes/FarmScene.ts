import * as Phaser from 'phaser';
import { playCue } from '../audio/playCue';
import { floatText } from '../components/floatingText';
import { WorldFx } from '../fx/WorldFx';
import { createFarmGrid } from '../iso/createFarmGrid';
import type { IsoGrid } from '../iso/IsoGrid';
import { AutosaveManager } from '../managers/AutosaveManager';
import { CameraManager } from '../managers/CameraManager';
import { effectsEnabled, reducedMotion } from '../fx/prefs';
import { createWorldShape, farmFocus, worldArea, WorldScenery } from '../scenery/WorldScenery';
import { FishingSpots } from '../scenery/FishingSpots';
import { Landmarks } from '../scenery/Landmarks';
import { LandView } from '../scenery/LandView';
import { getSession, getTools, getUiBus } from '../session';
import type { Tool } from '../tools';
import { TEXT } from '../theme';
import { BuildCursor, type Cell } from '../world/BuildCursor';
import { FarmSweep } from '../world/FarmSweep';
import { pickObject, spotUnder, type GridPoint } from '../world/spots';
import { WorldView } from '../world/WorldView';
import { formatDuration } from '../ui/format';

const MS_PER_SEC = 1000;
const CONFIRM_MS = 2500;

type Say = (message: string, color: string) => void;

export class FarmScene extends Phaser.Scene {
  private grid!: IsoGrid;
  private world!: WorldView;
  private scenery!: WorldScenery;
  private cursor!: BuildCursor;
  private cameraControl!: CameraManager;
  private fishingSpots!: FishingSpots;
  private fx!: WorldFx;
  private landmarks!: Landmarks;
  private hoveredCell: Cell | null = null;
  private hoverPoint: GridPoint | null = null;
  private sweep!: FarmSweep;
  /** A planted plot the remove tool was tapped on once; a second tap digs it up. */
  private pendingDig: { plotId: number; until: number } | null = null;

  constructor() {
    super('Farm');
  }

  create(): void {
    const session = getSession(this);
    const tools = getTools(this);
    this.grid = createFarmGrid(session);
    const shape = createWorldShape(this.grid, session.config.farm.paths);
    const season = session.seasons.current().id;
    this.scenery = new WorldScenery(this, this.grid, shape, season);
    this.landmarks = new Landmarks(this, session, this.grid, shape, season);
    session.bus.on('SeasonChanged', ({ seasonId }) => {
      this.scenery.setSeason(seasonId);
      this.landmarks.setSeason(seasonId);
    });
    new LandView(this, session, this.grid);
    this.fishingSpots = new FishingSpots(this, session, this.grid);
    this.world = new WorldView(this, session, this.grid);
    this.cursor = new BuildCursor(this, session, this.grid);
    this.sweep = new FarmSweep(session, (message, at) =>
      this.say(this.cellOf(at), message, TEXT.error),
    );
    this.fx = new WorldFx(this, session, this.grid, this.world, this.fishingSpots, (id) =>
      this.landmarks.pointOf(id),
    );
    this.cameraControl = new CameraManager(
      this,
      worldArea(this.grid),
      farmFocus(this.grid),
      () => this.sweep.isActive,
    );
    new AutosaveManager(this, session);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.sweep.begin(tools.tool, this.pointOf(pointer));
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.hover(pointer);
      if (pointer.isDown) this.sweep.move(this.pointOf(pointer));
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const swept = this.sweep.isActive && this.sweep.end();
      if (pointer.rightButtonReleased()) tools.clear();
      else if (!swept && !this.cameraControl.isDragging) this.tap(pointer);
    });
    this.input.keyboard?.on('keydown-ESC', () => tools.clear());
    this.input.keyboard?.on('keydown-R', () => this.turnHeld());
    this.input.mouse?.disableContextMenu();
    tools.bus.on('ToolChanged', ({ tool }) => {
      this.cursor.show(this.hoverPoint, tool);
      this.world.setLifted(tool.kind === 'move' ? tool.objectId : null);
    });
    getUiBus(this).on('FocusMap', ({ featureId }) => {
      const point = featureId === 'farm' ? farmFocus(this.grid) : this.landmarks.pointOf(featureId);
      if (point) this.cameraControl.panTo(point, !reducedMotion(this));
    });
    for (const event of ['MoneyChanged', 'ObjectPlaced', 'ObjectMoved', 'ObjectRemoved'] as const) {
      session.bus.on(event, () => this.cursor.show(this.hoverPoint, tools.tool));
    }
    session.bus.on('CropHarvested', ({ plotId, cropId, amount, xp }) => {
      const view = this.world.plotView(plotId);
      if (!view) return;
      const { x, y } = view.center();
      floatText(this, x, y, `+${amount} ${session.crops.get(cropId).name}`, TEXT.success);
      floatText(this, x, y + 22, `+${xp} xp`, TEXT.gold);
    });
  }

  // The game clock ticks in the UI scene, which keeps running while this one sleeps (mine).
  override update(_time: number, deltaMs: number): void {
    this.world.update();
    this.fishingSpots.update();
    this.landmarks.update();
    this.scenery.update(deltaMs / MS_PER_SEC, reducedMotion(this), effectsEnabled(this));
    this.fx.update(deltaMs);
  }

  private cellAt(pointer: Phaser.Input.Pointer): Cell {
    return this.grid.cellAt(pointer.worldX, pointer.worldY);
  }

  private pointOf(pointer: Phaser.Input.Pointer): GridPoint {
    return this.grid.toGrid(pointer.worldX, pointer.worldY);
  }

  private cellOf(point: GridPoint): Cell {
    return { col: Math.floor(point.col), row: Math.floor(point.row) };
  }

  private say(cell: Cell, message: string, color: string): void {
    const { x, y } = this.grid.tileCenter(cell.col, cell.row);
    floatText(this, x, y, message, color);
    if (color !== TEXT.error) return;
    playCue(this, 'error');
    getUiBus(this).emit('Denied', { reason: message });
  }

  // R turns whatever is being moved before it is set down.
  private turnHeld(): void {
    const tools = getTools(this);
    const tool = tools.tool;
    if (tool.kind !== 'move' || tool.objectId === null) return;
    tools.set({ ...tool, rotated: !tool.rotated });
  }

  private hover(pointer: Phaser.Input.Pointer): void {
    const cell = this.cellAt(pointer);
    this.hoverPoint = this.pointOf(pointer);
    const tool = getTools(this).tool;
    const tracksEdges = tool.kind === 'build' || tool.kind === 'move' || tool.kind === 'remove';
    const sameCell = this.hoveredCell?.col === cell.col && this.hoveredCell.row === cell.row;
    if (sameCell && !tracksEdges) return;
    if (!sameCell) {
      this.setPlotHover(this.hoveredCell, false);
      this.hoveredCell = cell;
      this.setPlotHover(cell, true);
    }
    this.cursor.show(this.hoverPoint, tool);
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
    if (tool.kind === 'none' && this.tapLandmark(pointer)) return;
    const say: Say = (message, color) => this.say(cell, message, color);
    const point = this.pointOf(pointer);

    if (!session.world.inBounds(cell.col, cell.row)) {
      const exact = this.grid.toGrid(pointer.worldX, pointer.worldY);
      const spotId = this.fishingSpots.spotAt(exact.col, exact.row);
      if (spotId && tool.kind === 'none') getUiBus(this).emit('OpenFishing', { spotId });
      return;
    }
    if (tool.kind === 'build') {
      const spot = spotUnder(point, session.world.isEdgeItem(tool.itemId));
      const result = session.farm.build(tool.itemId, spot);
      if (!result.ok) say(result.reason, TEXT.error);
      return;
    }
    if (tool.kind === 'move') {
      this.tapMove(tool, point, say);
      return;
    }
    if (tool.kind === 'remove') {
      const picked = pickObject(session.world, point);
      if (picked) this.remove(picked.id, say);
      this.cursor.show(point, tool);
      return;
    }
    const target = session.world.objectAt(cell.col, cell.row);
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

  // First tap picks something up, the next sets it down (turned if R was pressed).
  private tapMove(tool: Extract<Tool, { kind: 'move' }>, point: GridPoint, say: Say): void {
    const session = getSession(this);
    const tools = getTools(this);
    if (tool.objectId === null) {
      const picked = pickObject(session.world, point);
      if (picked) tools.set({ kind: 'move', objectId: picked.id, rotated: picked.rotated });
      return;
    }
    const object = session.world.get(tool.objectId);
    if (!object) {
      tools.set({ kind: 'move', objectId: null });
      return;
    }
    const spot = spotUnder(point, session.world.isEdgeItem(object.itemId), tool.rotated);
    const result = session.farm.move(object.id, spot);
    if (!result.ok) {
      say(result.reason, TEXT.error);
      return;
    }
    tools.set({ kind: 'move', objectId: null });
  }

  private tapLandmark(pointer: Phaser.Input.Pointer): boolean {
    const tap = this.landmarks.tapAt(pointer.worldX, pointer.worldY);
    if (!tap) return false;
    const uiBus = getUiBus(this);
    if (tap.kind === 'mine') uiBus.emit('OpenMine', {});
    else if (tap.kind === 'harbor') uiBus.emit('OpenHarbor', {});
    else uiBus.emit('Discover', { id: tap.id });
    return true;
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
