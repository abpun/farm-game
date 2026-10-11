import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { formatMoney } from '../format';
import { iconKey } from '../uiTextures';
import { UI_TEXT } from '../uiTheme';
import { Modal } from '../widgets/Modal';
import type { ToastManager } from '../widgets/ToastManager';

export function openLandDialog(
  scene: Phaser.Scene,
  session: GameSession,
  toasts: ToastManager,
  col: number,
  row: number,
): void {
  const block = session.farm.blockAt(col, row);
  if (!block) {
    toasts.show("That land isn't for sale", { icon: iconKey('land') });
    return;
  }
  const locked = !session.progression.isUnlocked(block.unlockLevel);
  const reachable = session.farm.touchesOwned(block);
  Modal.open(scene, {
    title: 'Expand your land',
    message:
      `Clear this ${block.cols}×${block.rows} plot for $${formatMoney(block.price)}.` +
      (locked ? ` Needs level ${block.unlockLevel}.` : '') +
      (!locked && !reachable ? ' Clear the land next to it first.' : ''),
    actions: [
      {
        label: `Buy for $${formatMoney(block.price)}`,
        icon: iconKey('land'),
        onClick: () => {
          const result = session.farm.claimBlock(block.id);
          toasts.show(result.ok ? 'Your farm grew! New land is ready.' : result.reason, {
            icon: iconKey('land'),
            color: result.ok ? UI_TEXT.gold : UI_TEXT.danger,
          });
        },
      },
      { label: 'Not now', onClick: () => undefined },
    ],
  });
}
