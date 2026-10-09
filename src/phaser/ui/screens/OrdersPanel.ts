import type * as Phaser from 'phaser';
import type { Order } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { DRAWER } from '../../layout';
import { formatDuration, formatMoney } from '../format';
import { iconImage } from '../icons';
import { itemIconKey } from '../itemIcons';
import { chipRow, fitText } from '../rows';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Drawer } from '../widgets/Drawer';
import { createFrame } from '../widgets/Frame';
import { PagedList } from '../widgets/PagedList';
import type { ToastManager } from '../widgets/ToastManager';

type Tab = 'board' | 'active' | 'history';

const TAB_HEIGHT = UI_PX * 14;
const HEADER_HEIGHT = UI_PX * 11;
const CARD_HEIGHT = UI_PX * 36;
const CARD_GAP = UI_PX * 2;
const ITEM_ICON = UI_PX * 9;
const ITEM_SLOT = UI_PX * 26;
const ACTION_WIDTH = UI_PX * 30;
const ACTION_HEIGHT = UI_PX * 12;
const TICK_MS = 5000;
const PAD = UI_PX * 3;

// Orders drawer: the delivery board, running orders with deadlines, and past orders.
export class OrdersPanel {
  readonly drawer: Drawer;
  private readonly tabs: Map<string, Button>;
  private readonly header: Phaser.GameObjects.Text;
  private readonly list: PagedList<Order>;
  private tab: Tab = 'board';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly toasts: ToastManager,
    x: number,
    y: number,
  ) {
    this.drawer = new Drawer(scene, x, y, DRAWER.width, DRAWER.height, 'Orders', 'right');
    const page = this.drawer.content;
    const width = this.drawer.innerWidth;
    this.tabs = chipRow(
      scene,
      page,
      0,
      width,
      TAB_HEIGHT,
      [
        { id: 'board', label: 'Board' },
        { id: 'active', label: 'Active' },
        { id: 'history', label: 'History' },
      ],
      (id) => this.show(id as Tab),
    );
    this.header = scene.add.text(
      0,
      TAB_HEIGHT + UI_PX * 2,
      '',
      uiText(FONT_SIZE.small, UI_TEXT.muted),
    );
    const listY = TAB_HEIGHT + HEADER_HEIGHT + UI_PX * 2;
    this.list = new PagedList<Order>(
      scene,
      0,
      listY,
      width,
      this.drawer.innerHeight - listY,
      CARD_HEIGHT,
      CARD_GAP,
      (order, w, h) => this.card(order, w, h),
    );
    page.add([this.header, this.list]);

    const refresh = () => this.refresh();
    for (const event of ['OrdersChanged', 'InventoryChanged', 'LevelUp'] as const) {
      session.bus.on(event, refresh);
    }
    this.drawer.on('drawer-opened', refresh);
    scene.time.addEvent({ delay: TICK_MS, loop: true, callback: refresh });
    this.show('board');
  }

  /** Orders the player could hand in right now (for the dock badge). */
  deliverableCount(): number {
    return this.session.orders.active().filter((order) => this.session.orders.canDeliver(order))
      .length;
  }

  private show(tab: Tab): void {
    this.tab = tab;
    this.tabs.forEach((button, id) => button.setSelected(id === tab));
    this.list.resetPage();
    this.refresh(true);
  }

  private refresh(force = false): void {
    if (!force && !this.drawer.isOpen) return;
    const { orders } = this.session;
    const active = orders.active();
    this.tabs.get('active')?.setLabel(`Active ${active.length}`);
    this.header.setText(
      `Reputation ${orders.reputation()} · ${orders.slots()} board slots · ` +
        `${active.length}/${this.session.config.orders.maxActive} active`,
    );
    if (this.tab === 'board') {
      const daily = orders.daily();
      const refill = orders.nextRefill();
      const wait =
        refill === null ? '' : ` Next one in ${formatDuration(refill - this.session.time.now())}.`;
      this.list.setItems(
        [...(daily ? [daily] : []), ...orders.offers()],
        `No orders right now.${wait}`,
      );
    } else if (this.tab === 'active') {
      this.list.setItems([...active], 'No active orders. Accept one from the board.');
    } else {
      this.list.setItems([...orders.history()], 'Completed and expired orders show up here.');
    }
  }

  private card(order: Order, width: number, height: number): Phaser.GameObjects.GameObject[] {
    const { scene, session } = this;
    const { content, inventory } = session;
    const objects: Phaser.GameObjects.GameObject[] = [
      createFrame(scene, 0, 0, width, height, order.daily ? 'slotSelected' : 'slot'),
    ];
    const category =
      session.config.orders.categories.find((c) => c.id === order.category)?.name ?? '';
    const difficulty =
      session.config.orders.difficulties.find((d) => d.id === order.difficulty)?.name ?? '';
    const title = order.daily
      ? `Daily contract · ${order.customer}`
      : `${order.customer} · ${category}`;
    objects.push(
      fitText(
        scene.add.text(PAD, PAD, title, uiText(FONT_SIZE.body)),
        width - ACTION_WIDTH - PAD * 3,
      ),
    );

    let x = PAD;
    const itemsY = PAD + UI_PX * 12;
    for (const [id, need] of Object.entries(order.items)) {
      const have = inventory.count(id);
      objects.push(
        iconImage(
          scene,
          itemIconKey(content, id),
          x + ITEM_ICON / 2,
          itemsY + ITEM_ICON / 2,
          ITEM_ICON,
        ),
      );
      const enough = order.status !== 'active' || have >= need;
      const label =
        order.status === 'active' ? `${Math.min(have, need)}/${need}` : `${need} (${have})`;
      objects.push(
        scene.add
          .text(
            x + ITEM_ICON + UI_PX,
            itemsY + ITEM_ICON / 2,
            label,
            uiText(FONT_SIZE.small, enough ? UI_TEXT.dark : UI_TEXT.danger),
          )
          .setOrigin(0, 0.5),
      );
      x += ITEM_SLOT;
    }

    const bonus = order.bonusCoins > 0 ? ` (+$${order.bonusCoins} fast)` : '';
    const reward = `$${formatMoney(order.coins)}${bonus} · ${order.xp}xp · +${order.reputation} rep · ${difficulty}`;
    const rewardY = height - PAD - UI_PX * 4;
    objects.push(
      fitText(
        scene.add
          .text(PAD, rewardY, reward, uiText(FONT_SIZE.small, UI_TEXT.muted))
          .setOrigin(0, 0.5),
        width - ACTION_WIDTH - PAD * 3,
      ),
    );
    objects.push(...this.actions(order, width));
    const timing = this.timing(order);
    if (timing) {
      objects.push(
        scene.add
          .text(width - PAD, PAD, timing.text, uiText(FONT_SIZE.small, timing.color))
          .setOrigin(1, 0),
      );
    }
    return objects;
  }

  private timing(order: Order): { text: string; color: string } | null {
    const now = this.session.time.now();
    if (order.status === 'available') {
      return { text: `${formatDuration(order.durationSec)} to deliver`, color: UI_TEXT.muted };
    }
    if (order.status === 'active') {
      const deadline = this.session.orders.deadline(order) ?? now;
      const bonusLeft = (order.acceptedAt ?? now) + order.bonusWithinSec - now;
      const text = `${formatDuration(deadline - now)} left${bonusLeft > 0 ? ' · bonus!' : ''}`;
      return {
        text,
        color:
          deadline - now < this.session.config.farm.dayLengthSec ? UI_TEXT.danger : UI_TEXT.muted,
      };
    }
    if (order.status === 'completed') {
      return { text: order.bonusEarned ? 'Delivered · bonus' : 'Delivered', color: UI_TEXT.good };
    }
    return { text: 'Expired', color: UI_TEXT.danger };
  }

  private actions(order: Order, width: number): Button[] {
    const { orders } = this.session;
    const x = width - ACTION_WIDTH - PAD;
    const top = UI_PX * 13;
    const button = (y: number, label: string, enabled: boolean, onClick: () => void) =>
      new Button(this.scene, x, y, {
        width: ACTION_WIDTH,
        height: ACTION_HEIGHT,
        label,
        fontSize: FONT_SIZE.small,
        align: 'center',
        onClick,
      }).setEnabled(enabled);
    if (order.status === 'available') {
      const full = orders.active().length >= this.session.config.orders.maxActive;
      const buttons = [
        button(top, 'Accept', !full, () => this.act(orders.accept(order.id), 'Order accepted')),
      ];
      if (!order.daily) {
        buttons.push(
          button(top + ACTION_HEIGHT + UI_PX * 2, 'Skip', true, () =>
            this.act(orders.discard(order.id), 'A new order will arrive soon'),
          ),
        );
      }
      return buttons;
    }
    if (order.status === 'active') {
      return [
        button(top, 'Deliver', orders.canDeliver(order), () => this.deliver(order)),
        button(top + ACTION_HEIGHT + UI_PX * 2, 'Give up', true, () =>
          this.act(orders.abandon(order.id), 'Order cancelled'),
        ),
      ];
    }
    return [];
  }

  private deliver(order: Order): void {
    const result = this.session.orders.deliver(order.id);
    if (!result.ok) {
      this.act(result, '');
      return;
    }
    const delivered = this.session.orders.history().find((o) => o.id === order.id);
    const bonus = delivered?.bonusEarned ? ` +$${order.bonusCoins} bonus` : '';
    this.toasts.show(`Delivered to ${order.customer}! $${formatMoney(order.coins)}${bonus}`, {
      icon: iconKey('orders'),
      color: UI_TEXT.gold,
    });
  }

  private act(result: { ok: true } | { ok: false; reason: string }, success: string): void {
    if (result.ok && !success) return;
    this.toasts.show(result.ok ? success : result.reason, {
      icon: iconKey('orders'),
      color: result.ok ? UI_TEXT.gold : UI_TEXT.danger,
    });
  }
}
