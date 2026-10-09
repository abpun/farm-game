import type * as Phaser from 'phaser';
import type { ItemCategory } from '@core/entities/content';
import type { GameSession } from '@core/GameSession';
import { DRAWER } from '../../layout';
import { formatMoney } from '../format';
import { itemIconKey } from '../itemIcons';
import { chipRow, slotRow } from '../rows';
import { iconKey, type IconName } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Drawer } from '../widgets/Drawer';
import { Modal } from '../widgets/Modal';
import { PagedList } from '../widgets/PagedList';
import { BAR_COLORS, ProgressBar } from '../widgets/ProgressBar';
import type { ToastManager } from '../widgets/ToastManager';
import { openTradeDialog } from './TradeDialog';

const ROW_GAP = UI_PX * 2;
const ROW_HEIGHT = UI_PX * 20;
const HEADER_HEIGHT = UI_PX * 18;
const CHIP_HEIGHT = UI_PX * 16;
const FOOTER_HEIGHT = UI_PX * 18;
const UPGRADE_WIDTH = UI_PX * 44;
const NEARLY_FULL = 0.9;

const TABS: Array<{ id: ItemCategory; name: string; icon: IconName }> = [
  { id: 'crop', name: 'Crops', icon: 'seed' },
  { id: 'fruit', name: 'Fruit', icon: 'orchard' },
  { id: 'fish', name: 'Fish', icon: 'fishing' },
  { id: 'animal', name: 'Animal products', icon: 'chicken' },
  { id: 'goods', name: 'Goods', icon: 'crafting' },
  { id: 'supply', name: 'Supplies', icon: 'supplies' },
];

// Barn drawer: the one shared inventory, with storage capacity and selling.
export class BarnPanel {
  readonly drawer: Drawer;
  private readonly capacityText: Phaser.GameObjects.Text;
  private readonly capacityBar: ProgressBar;
  private readonly upgrade: Button;
  private readonly chips: Map<string, Button>;
  private readonly list: PagedList<string>;
  private readonly sellAll: Button;
  private tab: ItemCategory = 'crop';

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
    this.capacityText = scene.add.text(0, 0, '', uiText(FONT_SIZE.body));
    this.capacityBar = new ProgressBar(
      scene,
      0,
      UI_PX * 11,
      width - UPGRADE_WIDTH - UI_PX * 3,
      UI_PX * 5,
    );
    this.upgrade = new Button(scene, width - UPGRADE_WIDTH, 0, {
      width: UPGRADE_WIDTH,
      height: HEADER_HEIGHT - UI_PX * 2,
      label: '',
      fontSize: FONT_SIZE.small,
      align: 'center',
      onClick: () => this.upgradeStorage(),
    });
    page.add([this.capacityText, this.capacityBar, this.upgrade]);
    const chipsY = HEADER_HEIGHT + UI_PX;
    this.chips = chipRow(
      scene,
      page,
      chipsY,
      width,
      CHIP_HEIGHT,
      TABS.map((tab) => ({ id: tab.id, icon: iconKey(tab.icon) })),
      (id) => this.show(id as ItemCategory),
    );
    const listY = chipsY + CHIP_HEIGHT + UI_PX * 3;
    const listHeight = this.drawer.innerHeight - listY - FOOTER_HEIGHT - UI_PX * 3;
    this.list = new PagedList<string>(
      scene,
      0,
      listY,
      width,
      listHeight,
      ROW_HEIGHT,
      ROW_GAP,
      (id, w, h) => this.row(id, w, h),
    );
    this.sellAll = new Button(scene, 0, this.drawer.innerHeight - FOOTER_HEIGHT, {
      width,
      height: FOOTER_HEIGHT,
      label: '',
      icon: iconKey('coin'),
      iconSize: UI_PX * 8,
      align: 'center',
      onClick: () => this.confirmSellAll(),
    });
    page.add([this.list, this.sellAll]);

    const refresh = () => this.refresh();
    for (const event of [
      'InventoryChanged',
      'MoneyChanged',
      'StorageUpgraded',
      'LevelUp',
    ] as const) {
      session.bus.on(event, refresh);
    }
    this.drawer.on('drawer-opened', refresh);
    this.show('crop');
  }

  private show(tab: ItemCategory): void {
    this.tab = tab;
    this.chips.forEach((chip, id) => chip.setSelected(id === tab));
    this.list.resetPage();
    this.refresh(true);
  }

  private refresh(force = false): void {
    if (!force && !this.drawer.isOpen) return;
    const { inventory, content } = this.session;
    const used = inventory.used();
    const capacity = inventory.capacity();
    this.capacityText.setText(`Storage ${used} / ${capacity}`);
    this.capacityText.setColor(used >= capacity ? UI_TEXT.danger : UI_TEXT.dark);
    this.capacityBar
      .setProgress(used / Math.max(1, capacity))
      .setColor(used / Math.max(1, capacity) >= NEARLY_FULL ? BAR_COLORS.full : BAR_COLORS.grow);
    const next = inventory.nextStorage();
    this.upgrade
      .setLabel(next ? `+${next.capacity - capacity} $${formatMoney(next.cost)}` : 'Max size')
      .setEnabled(Boolean(next) && this.session.economy.canAfford(next?.cost ?? 0));

    const ids = inventory
      .entries()
      .map(([id]) => id)
      .filter((id) => content.items.get(id).category === this.tab);
    const name = TABS.find((t) => t.id === this.tab)?.name ?? '';
    this.list.setItems(ids, `No ${name.toLowerCase()} yet`);
    const value = ids.reduce(
      (sum, id) => sum + content.items.get(id).sellPrice * inventory.count(id),
      0,
    );
    this.sellAll
      .setLabel(`Sell all ${name.toLowerCase()} $${formatMoney(value)}`)
      .setEnabled(value > 0);
  }

  private row(itemId: string, width: number, height: number) {
    const { content, inventory } = this.session;
    const item = content.items.get(itemId);
    const count = inventory.count(itemId);
    const sellable = item.sellPrice > 0;
    return slotRow(this.scene, width, height, {
      icon: itemIconKey(content, itemId),
      title: `${item.name} ×${count}`,
      subtitle: sellable ? `$${formatMoney(item.sellPrice)} each` : 'Not for sale',
      actions: [
        {
          label: 'Sell',
          enabled: sellable,
          onClick: () => openTradeDialog(this.scene, this.session, this.toasts, 'sell', itemId),
        },
      ],
    });
  }

  private upgradeStorage(): void {
    const result = this.session.farm.upgradeStorage();
    this.toasts.show(
      result.ok ? `Barn upgraded: room for ${this.session.inventory.capacity()}` : result.reason,
      { icon: iconKey('barn'), color: result.ok ? UI_TEXT.gold : UI_TEXT.danger },
    );
  }

  private confirmSellAll(): void {
    const name = TABS.find((t) => t.id === this.tab)?.name.toLowerCase() ?? '';
    Modal.open(this.scene, {
      title: 'Sell everything?',
      message: `Sell all ${name} in the barn? Orders and recipes may need them.`,
      actions: [
        {
          label: 'Sell them all',
          icon: iconKey('coin'),
          onClick: () => {
            const revenue = this.session.farm.sellEverything(this.tab);
            if (revenue > 0) {
              this.toasts.show(`Sold all ${name} for $${formatMoney(revenue)}`, {
                icon: iconKey('coin'),
                color: UI_TEXT.gold,
              });
            }
          },
        },
        { label: 'Keep them', onClick: () => undefined },
      ],
    });
  }
}
