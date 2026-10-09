import type * as Phaser from 'phaser';
import type { CropDef } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { cropIconKey } from '../../art/CropArtist';
import { DRAWER } from '../../layout';
import { formatMoney } from '../format';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Drawer } from '../widgets/Drawer';
import { createFrame } from '../widgets/Frame';
import type { ToastManager } from '../widgets/ToastManager';

const ROW_GAP = UI_PX * 2;
const ICON_SIZE = UI_PX * 18;
const SELL_WIDTH = UI_PX * 36;
const FOOTER_HEIGHT = UI_PX * 18;

// Barn drawer: what has been harvested, with per-crop and sell-everything buttons.
export class BarnPanel {
  readonly drawer: Drawer;
  private readonly rows = new Map<string, { count: Phaser.GameObjects.Text; sell: Button }>();
  private readonly sellEverything: Button;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly toasts: ToastManager,
    x: number,
    y: number,
  ) {
    this.drawer = new Drawer(scene, x, y, DRAWER.width, DRAWER.height, 'Barn', 'right');
    const page = this.drawer.content;
    const width = this.drawer.innerWidth;
    session.crops.all().forEach((crop, index) => this.addRow(page, crop, index, width));

    this.sellEverything = new Button(scene, 0, this.drawer.innerHeight - FOOTER_HEIGHT, {
      width,
      height: FOOTER_HEIGHT,
      label: 'Sell everything',
      icon: iconKey('coin'),
      iconSize: UI_PX * 8,
      align: 'center',
      onClick: () => this.sellAll(),
    });
    page.add(this.sellEverything);

    session.bus.on('InventoryChanged', () => this.refresh());
    this.refresh();
  }

  private addRow(
    page: Phaser.GameObjects.Container,
    crop: CropDef,
    index: number,
    width: number,
  ): void {
    const height = DRAWER.rowHeight;
    const y = index * (height + ROW_GAP);
    const icon = this.scene.add
      .image(UI_PX * 4, y + height / 2, cropIconKey(crop.id))
      .setOrigin(0, 0.5);
    icon.setScale(Math.floor(ICON_SIZE / icon.height));
    const count = this.scene.add
      .text(UI_PX * 8 + icon.displayWidth, y + height / 2, '', uiText(FONT_SIZE.body))
      .setOrigin(0, 0.5);
    const sell = new Button(this.scene, width - SELL_WIDTH - UI_PX * 3, y + UI_PX * 3, {
      width: SELL_WIDTH,
      height: height - UI_PX * 6,
      label: '',
      fontSize: FONT_SIZE.small,
      align: 'center',
      onClick: () => this.sell(crop),
    });
    page.add([createFrame(this.scene, 0, y, width, height, 'slot'), icon, count, sell]);
    this.rows.set(crop.id, { count, sell });
  }

  private sell(crop: CropDef): void {
    const count = this.session.inventory.count(crop.id);
    if (!this.session.farm.sellAll(crop.id).ok) return;
    this.toasts.show(`Sold ${count} ${crop.name} for $${formatMoney(count * crop.sellPrice)}`, {
      icon: cropIconKey(crop.id),
      color: UI_TEXT.gold,
    });
  }

  private sellAll(): void {
    const revenue = this.session.farm.sellEverything();
    if (revenue === 0) return;
    this.toasts.show(`Sold everything for $${formatMoney(revenue)}`, {
      icon: iconKey('coin'),
      color: UI_TEXT.gold,
    });
  }

  private refresh(): void {
    let total = 0;
    for (const crop of this.session.crops.all()) {
      const count = this.session.inventory.count(crop.id);
      total += count;
      const row = this.rows.get(crop.id);
      row?.count.setText(`${crop.name}  ×${count}`);
      row?.sell.setLabel(`$${formatMoney(count * crop.sellPrice)}`).setEnabled(count > 0);
    }
    this.sellEverything.setEnabled(total > 0);
  }
}
