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
): void {
  const next = session.farm.nextExpansion();
  if (!next) {
    toasts.show('The whole island is already yours', { icon: iconKey('land') });
    return;
  }
  const size = session.state.landSize;
  const locked = !session.progression.isUnlocked(next.unlockLevel);
  Modal.open(scene, {
    title: 'Expand your land',
    message:
      `Grow your farm from ${size}×${size} to ${next.size}×${next.size} tiles for ` +
      `$${formatMoney(next.price)}.` +
      (locked ? ` Needs level ${next.unlockLevel}.` : ''),
    actions: [
      {
        label: `Buy for $${formatMoney(next.price)}`,
        icon: iconKey('land'),
        onClick: () => {
          const result = session.farm.expandLand();
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
