import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { formatMoney } from '../format';
import { iconImage } from '../icons';
import { itemIconKey } from '../itemIcons';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Dialog } from '../widgets/Dialog';
import type { ToastManager } from '../widgets/ToastManager';

export type TradeMode = 'buy' | 'sell';

const WIDTH = UI_PX * 150;
const HEIGHT = UI_PX * 118;
const STEP_SIZE = UI_PX * 16;
const BIG_STEP = 10;

// Quantity picker for buying or selling one item, showing unit price, total and the
// balance afterwards. The core validates again on confirm, so the UI can't overspend.
export function openTradeDialog(
  scene: Phaser.Scene,
  session: GameSession,
  toasts: ToastManager,
  mode: TradeMode,
  itemId: string,
): void {
  const item = session.content.items.get(itemId);
  const unit = mode === 'buy' ? (item.buyPrice ?? 0) : item.sellPrice;
  const dialog = Dialog.open(scene, {
    title: `${mode === 'buy' ? 'Buy' : 'Sell'} ${item.name}`,
    width: WIDTH,
    height: HEIGHT,
  });
  const content = dialog.content;
  const width = dialog.innerWidth;
  const maxQuantity = () => {
    if (mode === 'sell') return session.inventory.count(itemId);
    const affordable = unit > 0 ? Math.floor(session.economy.balance() / unit) : 0;
    return Math.max(0, Math.min(affordable, session.inventory.freeSpace()));
  };
  let quantity = Math.min(1, maxQuantity());

  const icon = iconImage(
    scene,
    itemIconKey(session.content, itemId),
    UI_PX * 12,
    UI_PX * 10,
    UI_PX * 18,
  );
  const owned = scene.add.text(UI_PX * 26, UI_PX * 4, '', uiText(FONT_SIZE.body));
  const priceLine = scene.add.text(
    UI_PX * 26,
    UI_PX * 12,
    '',
    uiText(FONT_SIZE.small, UI_TEXT.muted),
  );
  const stepY = UI_PX * 24;
  const amount = scene.add
    .text(width / 2, stepY + STEP_SIZE / 2, '', uiText(FONT_SIZE.big))
    .setOrigin(0.5);
  const totals = scene.add.text(0, stepY + STEP_SIZE + UI_PX * 4, '', {
    ...uiText(FONT_SIZE.body),
    lineSpacing: UI_PX,
  });

  const step = (delta: number) => {
    quantity = Math.max(0, Math.min(maxQuantity(), quantity + delta));
    dialog.refresh();
  };
  const stepButton = (x: number, label: string, delta: number, iconName?: 'plus' | 'minus') =>
    new Button(scene, x, stepY, {
      width: STEP_SIZE + (iconName ? 0 : UI_PX * 6),
      height: STEP_SIZE,
      label: iconName ? undefined : label,
      icon: iconName ? iconKey(iconName) : undefined,
      iconSize: UI_PX * 7,
      fontSize: FONT_SIZE.small,
      align: 'center',
      onClick: () => step(delta),
    });
  const buttons = [
    stepButton(0, `-${BIG_STEP}`, -BIG_STEP),
    stepButton(STEP_SIZE + UI_PX * 8, '', -1, 'minus'),
    stepButton(width - STEP_SIZE * 2 - UI_PX * 14, '', 1, 'plus'),
    stepButton(width - STEP_SIZE - UI_PX * 6, `+${BIG_STEP}`, BIG_STEP),
  ];
  const confirm = new Button(scene, 0, dialog.innerHeight - UI_PX * 18, {
    width,
    height: UI_PX * 18,
    label: '',
    icon: iconKey('coin'),
    iconSize: UI_PX * 8,
    align: 'center',
    onClick: () => {
      const result =
        mode === 'buy' ? session.farm.buy(itemId, quantity) : session.farm.sell(itemId, quantity);
      if (!result.ok) {
        toasts.show(result.reason, { color: UI_TEXT.danger });
        return;
      }
      const total = formatMoney(quantity * unit);
      const verb = mode === 'buy' ? 'Bought' : 'Sold';
      toasts.show(`${verb} ${quantity} ${item.name} for $${total}`, {
        icon: itemIconKey(session.content, itemId),
        color: UI_TEXT.gold,
      });
      dialog.close();
    },
  });
  content.add([icon, owned, priceLine, amount, totals, ...buttons, confirm]);

  dialog.onRefresh(() => {
    quantity = Math.min(quantity, maxQuantity());
    const total = quantity * unit;
    const balance = session.economy.balance();
    const after = mode === 'buy' ? balance - total : balance + total;
    owned.setText(`You have ${session.inventory.count(itemId)}`);
    priceLine.setText(
      mode === 'buy'
        ? `$${formatMoney(unit)} each · barn space ${session.inventory.freeSpace()}`
        : `$${formatMoney(unit)} each`,
    );
    amount.setText(String(quantity));
    totals.setText(`Total: $${formatMoney(total)}\nCoins after: $${formatMoney(after)}`);
    confirm
      .setLabel(`${mode === 'buy' ? 'Buy' : 'Sell'} ${quantity} for $${formatMoney(total)}`)
      .setEnabled(quantity > 0);
  });
}
