import * as Phaser from 'phaser';
import { floatText } from '../components/floatingText';
import { createFarmGrid } from '../iso/createFarmGrid';
import type { IsoGrid } from '../iso/IsoGrid';
import { AutosaveManager } from '../managers/AutosaveManager';
import { CameraManager, paddedBounds } from '../managers/CameraManager';
import { createIslandShape, FarmScenery, islandExtent, sceneryFocus } from '../scenery/FarmScenery';
import { getSession, getTools } from '../session';
import { TEXT } from '../theme';
import { BuildCursor, type Cell } from '../world/BuildCursor';
import { WorldView } from '../world/WorldView';
import { formatDuration } from '../ui/format';

const MS_PER_SEC = 1000;

export class FarmScene extends Phaser.Scene {
  private grid!: IsoGrid;
  private world!: WorldView;
  private scenery!: FarmScenery;
  private cursor!: BuildCursor;
  private cameraControl!: CameraManager;
  private hoveredCell: Cell | null = null;

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
    this.world = new WorldView(this, session, this.grid);
    this.cursor = new BuildCursor(this, session, this.grid, this.world);
    this.cameraControl = new CameraManager(this, island, sceneryFocus(this.grid));
    new AutosaveManager(this, session);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.hover(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonReleased()) tools.clear();
      else if (!this.cameraControl.isDragging) this.tap(this.cellAt(pointer));
    });
    this.input.keyboard?.on('keydown-ESC', () => tools.clear());
    this.input.mouse?.disableContextMenu();
    tools.bus.on('ToolChanged', ({ tool }) => this.cursor.show(this.hoveredCell, tool));
    session.bus.on('MoneyChanged', () => this.cursor.show(this.hoveredCell, tools.tool));
    session.bus.on('CropHarvested', ({ plotId, cropId, amount }) => {
      const view = this.world.plotView(plotId);
      if (!view) return;
      const { x, y } = view.center();
      floatText(this, x, y, `+${amount} ${session.crops.get(cropId).name}`, TEXT.success);
    });
  }

  override update(_time: number, deltaMs: number): void {
    getSession(this).update(deltaMs / MS_PER_SEC);
    this.world.update();
    this.scenery.update(deltaMs / MS_PER_SEC);
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

  private tap(cell: Cell): void {
    const session = getSession(this);
    const tool = getTools(this).tool;
    if (!session.world.inBounds(cell.col, cell.row)) return;
    const say = (message: string, color: string) => {
      const { x, y } = this.grid.tileCenter(cell.col, cell.row);
      floatText(this, x, y, message, color);
    };

    if (tool.kind === 'build') {
      const result = session.farm.build(tool.itemId, cell.col, cell.row);
      if (!result.ok) say(result.reason, TEXT.error);
      this.cursor.show(cell, tool);
      return;
    }
    const target = session.world.objectAt(cell.col, cell.row);
    if (tool.kind === 'remove') {
      if (!target) return;
      const result = session.farm.demolish(target.id);
      say(result.ok ? 'Removed' : result.reason, result.ok ? TEXT.muted : TEXT.error);
      this.cursor.show(cell, tool);
      return;
    }
    if (!target || !session.plots.isPlot(target.id)) return;
    this.tapBed(target.id, tool.kind === 'plant' ? tool.cropId : null, say);
  }

  private tapBed(
    plotId: number,
    seed: string | null,
    say: (message: string, color: string) => void,
  ): void {
    const { farm, plots, crops } = getSession(this);
    if (plots.isReady(plotId)) {
      farm.harvest(plotId);
      return;
    }
    const growing = plots.cropOf(plotId);
    if (growing) {
      const remaining = plots.secondsRemaining(plotId);
      const when = Number.isFinite(remaining) ? formatDuration(remaining) : 'dormant this season';
      say(`${crops.get(growing).name}: ${when}`, TEXT.base);
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
