import type * as Phaser from 'phaser';
import type { AnimalDef } from '@core/entities/content';
import type { CatalogItem, CropDef } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { cropIconKey } from '../../art/CropArtist';
import { DRAWER } from '../../layout';
import type { Tool, ToolState } from '../../tools';
import { itemIconKey as catalogIconKey } from '../../world/itemArt';
import { formatDuration, formatMoney } from '../format';
import { itemIconKey } from '../itemIcons';
import { chipRow, slotRow } from '../rows';
import { iconKey, type IconName } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Drawer } from '../widgets/Drawer';
import { PagedList } from '../widgets/PagedList';
import type { ToastManager } from '../widgets/ToastManager';
import { openLandDialog } from './LandDialog';
import { openTradeDialog } from './TradeDialog';

const ROW_GAP = UI_PX * 2;
const CHIP_HEIGHT = UI_PX * 16;
const TITLE_HEIGHT = UI_PX * 18;
const FOOTER_HEIGHT = UI_PX * 18;

const CATEGORY_ICONS: Record<string, IconName> = {
  crops: 'seed',
  orchard: 'orchard',
  animals: 'chicken',
  supplies: 'supplies',
  production: 'production',
  buildings: 'build',
  plants: 'plants',
  decor: 'decor',
};

const CATEGORY_HINTS: Record<string, string> = {
  orchard: 'Build orchard plots, then plant trees',
  animals: 'Build housing, then buy animals',
  supplies: 'Feed and bait, delivered to the barn',
  production: 'Workshops that turn crops into goods',
  buildings: 'Pick a piece, then tap tiles',
  plants: 'Trees and shrubs for your farm',
  decor: 'Make the farm your own',
};

const paceTag = (rate: number) => (rate > 1 ? ' fast' : rate < 1 ? ' slow' : '');

type MarketEntry =
  | { kind: 'crop'; crop: CropDef }
  | { kind: 'build'; item: CatalogItem }
  | { kind: 'animal'; animal: AnimalDef }
  | { kind: 'supply'; itemId: string }
  | { kind: 'land' };

// Market drawer: seeds, saplings, buildings, animals and supplies. Picking something to
// place arms a tool and closes the drawer; supplies and animals are bought on the spot.
export class MarketPanel {
  readonly drawer: Drawer;
  private readonly chips: Map<string, Button>;
  private readonly list: PagedList<MarketEntry>;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly removeTool: Button;
  private category = 'crops';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly tools: ToolState,
    private readonly toasts: ToastManager,
    x: number,
    y: number,
  ) {
    this.drawer = new Drawer(scene, x, y, DRAWER.width, DRAWER.height, 'Market', 'right');
    const page = this.drawer.content;
    const width = this.drawer.innerWidth;
    const categories = session.catalog.categories().map((category) => ({
      id: category.id,
      icon: iconKey(CATEGORY_ICONS[category.id] ?? 'decor'),
    }));
    this.chips = chipRow(scene, page, 0, width, CHIP_HEIGHT, categories, (id) => this.show(id));
    const titleY = CHIP_HEIGHT + UI_PX * 3;
    this.title = scene.add.text(0, titleY, '', uiText(FONT_SIZE.title));
    this.hint = scene.add.text(0, titleY + UI_PX * 9, '', uiText(FONT_SIZE.small, UI_TEXT.muted));
    const listY = titleY + TITLE_HEIGHT + UI_PX * 2;
    const listHeight = this.drawer.innerHeight - listY - FOOTER_HEIGHT - UI_PX * 3;
    this.list = new PagedList<MarketEntry>(
      scene,
      0,
      listY,
      width,
      listHeight,
      DRAWER.rowHeight,
      ROW_GAP,
      (entry, w, h) => this.renderEntry(entry, w, h),
    );
    this.removeTool = new Button(scene, 0, this.drawer.innerHeight - FOOTER_HEIGHT, {
      width,
      height: FOOTER_HEIGHT,
      label: 'Remove things',
      icon: iconKey('reset'),
      iconSize: UI_PX * 8,
      align: 'center',
      onClick: () => this.pick({ kind: 'remove' }),
    });
    page.add([this.title, this.hint, this.list, this.removeTool]);

    const refresh = () => this.refresh();
    for (const event of [
      'MoneyChanged',
      'LevelUp',
      'SeasonChanged',
      'ObjectPlaced',
      'ObjectRemoved',
      'AnimalBought',
      'LandExpanded',
      'AchievementClaimed',
      'InventoryChanged',
    ] as const) {
      session.bus.on(event, refresh);
    }
    tools.bus.on('ToolChanged', refresh);
    this.drawer.on('drawer-opened', refresh);
    this.show(this.category);
  }

  private pick(tool: Tool): void {
    this.tools.toggle(tool);
    if (this.tools.tool.kind !== 'none') this.drawer.close();
    else this.refresh();
  }

  private show(categoryId: string): void {
    this.category = categoryId;
    const category = this.session.catalog.categories().find((c) => c.id === categoryId);
    this.title.setText(category?.name ?? '');
    this.chips.forEach((chip, id) => chip.setSelected(id === categoryId));
    this.list.resetPage();
    this.refresh(true);
  }

  private refresh(force = false): void {
    if (!force && !this.drawer.isOpen) return;
    this.hint.setText(
      this.category === 'crops' ? this.seasonHint() : (CATEGORY_HINTS[this.category] ?? ''),
    );
    this.list.setItems(this.entries(this.category));
    this.removeTool.setSelected(this.tools.tool.kind === 'remove');
  }

  private entries(categoryId: string): MarketEntry[] {
    const { crops, catalog, content } = this.session;
    const builds = catalog.listed(categoryId).map((item): MarketEntry => ({ kind: 'build', item }));
    switch (categoryId) {
      case 'crops':
        return crops
          .all()
          .filter((crop) => crop.plantOn === 'bed')
          .map((crop) => ({ kind: 'crop', crop }));
      case 'orchard':
        return [
          ...builds,
          ...crops
            .all()
            .filter((crop) => crop.plantOn === 'orchard')
            .map((crop): MarketEntry => ({ kind: 'crop', crop })),
        ];
      case 'animals':
        return [
          ...content.animals.all().map((animal): MarketEntry => ({ kind: 'animal', animal })),
          ...builds,
        ];
      case 'supplies':
        return content.items.buyable().map((item) => ({ kind: 'supply', itemId: item.id }));
      case 'buildings':
        return [...builds, { kind: 'land' }];
      default:
        return builds;
    }
  }

  private renderEntry(entry: MarketEntry, width: number, height: number) {
    switch (entry.kind) {
      case 'crop':
        return this.cropRow(entry.crop, width, height);
      case 'build':
        return this.buildRow(entry.item, width, height);
      case 'animal':
        return this.animalRow(entry.animal, width, height);
      case 'supply':
        return this.supplyRow(entry.itemId, width, height);
      case 'land':
        return this.landRow(width, height);
    }
  }

  private cropRow(crop: CropDef, width: number, height: number) {
    const { plots, progression, economy, seasons, crops } = this.session;
    const tool: Tool = { kind: 'plant', cropId: crop.id };
    const rate = plots.seasonRate(crop.id);
    const locked = !progression.isUnlocked(crop.unlockLevel);
    const time = crop.regrowSec
      ? `${formatDuration(crop.growthTimeSec / Math.max(rate, 0.01))}, regrows`
      : formatDuration(crop.growthTimeSec / Math.max(rate, 0.01));
    const subtitle = locked
      ? `Unlocks at level ${crop.unlockLevel}`
      : rate <= 0
        ? `Dormant in ${seasons.current().name}`
        : `${crop.yield}× $${crop.sellPrice} · ${time}${paceTag(rate)}`;
    return slotRow(this.scene, width, height, {
      icon: cropIconKey(crop.id),
      title: `${crops.plantName(crop.id)}  $${crop.seedCost}`,
      subtitle,
      subtitleColor: locked ? UI_TEXT.danger : undefined,
      enabled: !locked && rate > 0 && economy.canAfford(crop.seedCost),
      selected: this.tools.is(tool),
      onClick: () => this.pick(tool),
    });
  }

  private buildRow(item: CatalogItem, width: number, height: number) {
    const blocker = this.session.farm.buildBlocker(item.id);
    const tool: Tool = { kind: 'build', itemId: item.id };
    const affordable = this.session.economy.canAfford(item.price);
    const price = item.price > 0 ? `  $${formatMoney(item.price)}` : '';
    return slotRow(this.scene, width, height, {
      icon: catalogIconKey(this.scene, item),
      title: `${item.name}${price}`,
      subtitle: blocker ?? item.description,
      subtitleColor: blocker ? UI_TEXT.danger : undefined,
      enabled: blocker === null && affordable,
      selected: this.tools.is(tool),
      onClick: () => this.pick(tool),
    });
  }

  private animalRow(animal: AnimalDef, width: number, height: number) {
    const { progression, economy, ranch, buildings, catalog, content } = this.session;
    const homes = buildings.ofRole('housing').filter((id) => ranch.animalOf(id)?.id === animal.id);
    const room = homes.reduce((n, id) => n + ranch.capacity(id) - ranch.animals(id).length, 0);
    const owned = homes.reduce((n, id) => n + ranch.animals(id).length, 0);
    const locked = !progression.isUnlocked(animal.unlockLevel);
    const housing = catalog.get(animal.housing).name;
    const subtitle = locked
      ? `Unlocks at level ${animal.unlockLevel}`
      : homes.length === 0
        ? `Needs a ${housing}`
        : `${owned} owned · room for ${room} · gives ${content.items.name(animal.product)}`;
    return slotRow(this.scene, width, height, {
      icon: itemIconKey(content, animal.product),
      title: `${animal.name}  $${formatMoney(animal.price)}`,
      subtitle,
      subtitleColor: locked || homes.length === 0 ? UI_TEXT.danger : undefined,
      enabled: !locked && room > 0 && economy.canAfford(animal.price),
      onClick: () => {
        const result = ranch.buyAnimalAnywhere(animal.id);
        this.toasts.show(result.ok ? `A new ${animal.name} moved in!` : result.reason, {
          icon: itemIconKey(content, animal.product),
          color: result.ok ? UI_TEXT.gold : UI_TEXT.danger,
        });
      },
    });
  }

  private supplyRow(itemId: string, width: number, height: number) {
    const { content, progression, inventory } = this.session;
    const item = content.items.get(itemId);
    const locked = !progression.isUnlocked(item.unlockLevel);
    return slotRow(this.scene, width, height, {
      icon: itemIconKey(content, itemId),
      title: `${item.name}  $${formatMoney(item.buyPrice ?? 0)}`,
      subtitle: locked
        ? `Unlocks at level ${item.unlockLevel}`
        : `In barn: ${inventory.count(itemId)}`,
      subtitleColor: locked ? UI_TEXT.danger : undefined,
      enabled: !locked,
      onClick: () => openTradeDialog(this.scene, this.session, this.toasts, 'buy', itemId),
    });
  }

  private landRow(width: number, height: number) {
    const next = this.session.farm.nextExpansion();
    return slotRow(this.scene, width, height, {
      icon: iconKey('land'),
      title: next ? `Expand land  $${formatMoney(next.price)}` : 'All land owned',
      subtitle: next
        ? `Grow to ${next.size}×${next.size} tiles · level ${next.unlockLevel}`
        : 'The whole island is yours',
      enabled: Boolean(next),
      onClick: () => openLandDialog(this.scene, this.session, this.toasts),
    });
  }

  // Names the crops that grow faster than usual right now.
  private seasonHint(): string {
    const { crops, plots, seasons } = this.session;
    const good = crops
      .all()
      .filter((crop) => crop.plantOn === 'bed' && plots.seasonRate(crop.id) > 1);
    const names = good.map((crop) => crop.name).join(', ');
    return `${seasons.current().name}: ${names ? `${names} grow fast` : 'slow growing season'}`;
  }
}
