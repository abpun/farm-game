import type * as Phaser from 'phaser';
import type { CatalogItem, CropDef } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { cropIconKey } from '../../art/CropArtist';
import { DRAWER } from '../../layout';
import type { Tool, ToolState } from '../../tools';
import { itemIconKey } from '../../world/itemArt';
import { formatDuration, formatMoney } from '../format';
import { iconKey, type IconName } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Drawer } from '../widgets/Drawer';

const ROW_GAP = UI_PX * 2;
const ICON_SIZE = UI_PX * 18;
const CHIP_HEIGHT = UI_PX * 16;
const CHIP_GAP = UI_PX * 2;
const TITLE_HEIGHT = UI_PX * 14;
const FOOTER_HEIGHT = UI_PX * 18;

const CATEGORY_ICONS: Record<string, IconName> = {
  crops: 'seed',
  buildings: 'build',
  plants: 'plants',
  animals: 'chicken',
  decor: 'decor',
};

const CATEGORY_HINTS: Record<string, string> = {
  crops: 'Pick a seed, then tap empty beds',
  buildings: 'Pick a piece, then tap tiles',
  plants: 'Trees and shrubs for your farm',
  animals: 'Arriving in a future update',
  decor: 'Make the farm your own',
};

const paceTag = (rate: number) => (rate > 1 ? ' fast' : rate < 1 ? ' slow' : '');

interface ListRow {
  button: Button;
  tool: Tool | null;
  price: number;
  available: boolean;
}

// Market drawer: categories of things to plant or build. Picking one arms a tool and closes it.
export class MarketPanel {
  readonly drawer: Drawer;
  private readonly chips = new Map<string, Button>();
  private readonly list: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly removeTool: Button;
  private rows: ListRow[] = [];
  private category = 'crops';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly tools: ToolState,
    x: number,
    y: number,
  ) {
    this.drawer = new Drawer(scene, x, y, DRAWER.width, DRAWER.height, 'Market', 'right');
    const page = this.drawer.content;
    const width = this.drawer.innerWidth;
    this.buildChips(page, width);
    const titleY = CHIP_HEIGHT + UI_PX * 4;
    this.title = scene.add.text(0, titleY, '', uiText(FONT_SIZE.title));
    this.hint = scene.add.text(0, titleY + UI_PX * 9, '', uiText(FONT_SIZE.small, UI_TEXT.muted));
    this.list = scene.add.container(0, titleY + TITLE_HEIGHT + UI_PX * 4);
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

    session.bus.on('MoneyChanged', () => this.refresh());
    session.bus.on('SeasonChanged', () => this.showCategory(this.category));
    tools.bus.on('ToolChanged', () => this.refresh());
    this.showCategory(this.category);
  }

  private pick(tool: Tool): void {
    this.tools.toggle(tool);
    if (this.tools.tool.kind !== 'none') this.drawer.close();
  }

  private buildChips(page: Phaser.GameObjects.Container, width: number): void {
    const categories = this.session.catalog.categories();
    const chipWidth =
      Math.floor((width - CHIP_GAP * (categories.length - 1)) / categories.length / UI_PX) * UI_PX;
    categories.forEach((category, index) => {
      const chip = new Button(this.scene, index * (chipWidth + CHIP_GAP), 0, {
        width: chipWidth,
        height: CHIP_HEIGHT,
        icon: iconKey(CATEGORY_ICONS[category.id] ?? 'decor'),
        iconSize: UI_PX * 9,
        align: 'center',
        onClick: () => this.showCategory(category.id),
      });
      page.add(chip);
      this.chips.set(category.id, chip);
    });
  }

  private showCategory(categoryId: string): void {
    this.category = categoryId;
    const category = this.session.catalog.categories().find((c) => c.id === categoryId);
    this.title.setText(category?.name ?? '');
    this.hint.setText(
      categoryId === 'crops' ? this.seasonHint() : (CATEGORY_HINTS[categoryId] ?? ''),
    );
    this.chips.forEach((chip, id) => chip.setSelected(id === categoryId));

    this.list.removeAll(true);
    const entries =
      categoryId === 'crops'
        ? this.session.crops.all().map((crop) => this.cropRow(crop))
        : this.session.catalog.listed(categoryId).map((item) => this.itemRow(item));
    this.rows = entries.map((entry, index) => {
      entry.button.setY(index * (DRAWER.rowHeight + ROW_GAP));
      this.list.add(entry.button);
      return entry;
    });
    this.refresh();
  }

  private cropRow(crop: CropDef): ListRow {
    const tool: Tool = { kind: 'plant', cropId: crop.id };
    const rate = this.session.plots.seasonRate(crop.id);
    const pace =
      rate <= 0 ? 'dormant' : `${formatDuration(crop.growthTimeSec / rate)}${paceTag(rate)}`;
    return {
      tool,
      price: crop.seedCost,
      available: rate > 0,
      button: this.rowButton(
        `${crop.name}  $${crop.seedCost}`,
        `${crop.yield}× $${crop.sellPrice} · ${pace}`,
        cropIconKey(crop.id),
        () => this.pick(tool),
      ),
    };
  }

  // Names the crops that grow faster than usual right now.
  private seasonHint(): string {
    const { crops, plots, seasons } = this.session;
    const good = crops.all().filter((crop) => plots.seasonRate(crop.id) > 1);
    const names = good.map((crop) => crop.name).join(', ');
    return `${seasons.current().name}: ${names ? `${names} grow fast` : 'slow growing season'}`;
  }

  private itemRow(item: CatalogItem): ListRow {
    const tool: Tool = { kind: 'build', itemId: item.id };
    return {
      tool: item.available ? tool : null,
      price: item.price,
      available: item.available,
      button: this.rowButton(
        `${item.name}  $${formatMoney(item.price)}`,
        item.available ? item.description : 'Coming soon',
        itemIconKey(this.scene, item),
        () => this.pick(tool),
      ),
    };
  }

  private rowButton(label: string, sublabel: string, icon: string, onClick: () => void): Button {
    return new Button(this.scene, 0, 0, {
      width: this.drawer.innerWidth,
      height: DRAWER.rowHeight,
      label,
      sublabel,
      icon,
      iconSize: ICON_SIZE,
      skin: 'slot',
      onClick,
    });
  }

  private refresh(): void {
    const { economy } = this.session;
    for (const row of this.rows) {
      row.button
        .setSelected(row.tool !== null && this.tools.is(row.tool))
        .setEnabled(row.available && economy.canAfford(row.price));
    }
    this.removeTool.setSelected(this.tools.tool.kind === 'remove');
  }
}
