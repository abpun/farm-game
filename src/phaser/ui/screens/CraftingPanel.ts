import type * as Phaser from 'phaser';
import type { CatalogItem } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { DRAWER } from '../../layout';
import { itemIconKey as catalogIconKey } from '../../world/itemArt';
import { formatDuration } from '../format';
import { slotRow } from '../rows';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Drawer } from '../widgets/Drawer';
import { PagedList } from '../widgets/PagedList';

const ROW_GAP = UI_PX * 2;
const HINT_HEIGHT = UI_PX * 12;
const REFRESH_MS = 500;

type Entry = { kind: 'placed'; objectId: number } | { kind: 'unbuilt'; item: CatalogItem };

// Crafting drawer: every workshop and animal home at a glance; tap one to manage it.
export class CraftingPanel {
  readonly drawer: Drawer;
  private readonly list: PagedList<Entry>;
  private shown = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly openBuilding: (objectId: number) => void,
    x: number,
    y: number,
  ) {
    this.drawer = new Drawer(scene, x, y, DRAWER.width, DRAWER.height, 'Crafting', 'right');
    const page = this.drawer.content;
    const width = this.drawer.innerWidth;
    const hint = scene.add.text(0, 0, 'Tap a building to cook, mill or feed', {
      ...uiText(FONT_SIZE.small, UI_TEXT.muted),
    });
    this.list = new PagedList<Entry>(
      scene,
      0,
      HINT_HEIGHT,
      width,
      this.drawer.innerHeight - HINT_HEIGHT,
      DRAWER.rowHeight,
      ROW_GAP,
      (entry, w, h) =>
        entry.kind === 'placed'
          ? this.placedRow(entry.objectId, w, h)
          : this.unbuiltRow(entry.item, w, h),
    );
    page.add([hint, this.list]);
    this.drawer.on('drawer-opened', () => {
      this.shown = '';
      this.refresh();
    });
    scene.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });
  }

  private refresh(): void {
    if (!this.drawer.isOpen) return;
    const { buildings, catalog, world } = this.session;
    const placed = [...buildings.ofRole('production'), ...buildings.ofRole('housing')].map(
      (objectId): Entry => ({ kind: 'placed', objectId }),
    );
    const unbuilt = catalog
      .all()
      .filter((item) => this.session.content.buildings.has(item.id) && world.countOf(item.id) === 0)
      .map((item): Entry => ({ kind: 'unbuilt', item }));
    // Rebuilding rows mid-tap would swallow the click, so redraw only when something changed.
    const entries = [...placed, ...unbuilt];
    const signature = entries.map((entry) => this.signature(entry)).join('|');
    if (signature === this.shown) return;
    this.shown = signature;
    this.list.setItems(entries);
  }

  private signature(entry: Entry): string {
    if (entry.kind === 'unbuilt') {
      return `u:${entry.item.id}:${this.session.farm.buildBlocker(entry.item.id)}`;
    }
    const { buildings, production, ranch } = this.session;
    const id = entry.objectId;
    const building = Math.ceil(buildings.constructionRemaining(id));
    return [
      id,
      buildings.record(id).level,
      building,
      production.readyCount(id),
      buildings.record(id).queue.length,
      ranch.countByStatus(id, 'ready'),
      ranch.countByStatus(id, 'hungry'),
      ranch.animals(id).length,
    ].join(':');
  }

  private placedRow(objectId: number, width: number, height: number) {
    const { buildings, world, catalog, production, ranch } = this.session;
    const item = catalog.get(world.get(objectId)?.itemId ?? '');
    const level = buildings.record(objectId).level;
    let status: string;
    let color: string = UI_TEXT.muted;
    if (!buildings.isOperational(objectId)) {
      status = `Building… ${formatDuration(buildings.constructionRemaining(objectId))}`;
    } else if (buildings.def(objectId).role === 'production') {
      const ready = production.readyCount(objectId);
      const queued = buildings.record(objectId).queue.length;
      status =
        ready > 0
          ? `${ready} ready to collect`
          : queued > 0
            ? `Working · ${queued} queued`
            : 'Idle';
      color = ready > 0 ? UI_TEXT.good : queued > 0 ? UI_TEXT.muted : UI_TEXT.danger;
    } else {
      const total = ranch.animals(objectId).length;
      const ready = ranch.countByStatus(objectId, 'ready');
      const hungry = ranch.countByStatus(objectId, 'hungry');
      status =
        total === 0 ? 'No animals yet' : `${total} animals · ${ready} ready · ${hungry} hungry`;
      color = ready > 0 ? UI_TEXT.good : hungry > 0 ? UI_TEXT.danger : UI_TEXT.muted;
    }
    return slotRow(this.scene, width, height, {
      icon: catalogIconKey(this.scene, item),
      title: `${item.name} · Lv ${level}`,
      subtitle: status,
      subtitleColor: color,
      onClick: () => this.openBuilding(objectId),
    });
  }

  private unbuiltRow(item: CatalogItem, width: number, height: number) {
    const blocker = this.session.farm.buildBlocker(item.id);
    return slotRow(this.scene, width, height, {
      icon: catalogIconKey(this.scene, item),
      title: item.name,
      subtitle: blocker ?? 'Not built · find it in the Market',
      subtitleColor: UI_TEXT.muted,
      enabled: false,
      onClick: () => undefined,
    });
  }
}
