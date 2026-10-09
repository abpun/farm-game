import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { formatMoney } from '../format';
import { iconKey } from '../uiTextures';
import { UI_TEXT } from '../uiTheme';
import type { ToastManager, ToastOptions } from '../widgets/ToastManager';

const GAP_MS = 900;
const MAX_QUEUED = 6;
const MAX_UNLOCK_NAMES = 3;
/** Autosave retries often; warn about a failing save at most this often. */
const SAVE_WARNING_GAP_MS = 60_000;

/** Names of everything that opens up at exactly this player level. */
export function unlocksAt(session: GameSession, level: number): string[] {
  const { content } = session;
  return [
    ...content.crops
      .all()
      .filter((c) => c.unlockLevel === level)
      .map((c) => content.crops.plantName(c.id)),
    ...content.catalog
      .all()
      .filter((i) => i.unlockLevel === level && i.listed)
      .map((i) => i.name),
    ...content.animals
      .all()
      .filter((a) => a.unlockLevel === level)
      .map((a) => a.name),
    ...content.spots
      .all()
      .filter((s) => s.unlockLevel === level && level > 1)
      .map((s) => s.name),
  ];
}

// Gameplay announcements, paced so a burst (e.g. several trophies at once) never floods the screen.
export class Notifications {
  private readonly queue: Array<{ message: string; options: ToastOptions }> = [];
  private busy = false;
  private lastSaveWarning = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    session: GameSession,
    private readonly toasts: ToastManager,
  ) {
    const { bus, content, catalog } = session;
    bus.on('LevelUp', ({ level, coins }) => {
      const unlocked = unlocksAt(session, level);
      const names = unlocked.slice(0, MAX_UNLOCK_NAMES).join(', ');
      const more = unlocked.length > MAX_UNLOCK_NAMES ? '…' : '';
      this.push(
        `Level ${level}! +$${formatMoney(coins)}${names ? ` · New: ${names}${more}` : ''}`,
        {
          icon: iconKey('star'),
          color: UI_TEXT.gold,
        },
      );
    });
    bus.on('AchievementCompleted', ({ id }) =>
      this.push(`Trophy earned: ${content.achievements.get(id).name}! Claim it in Trophies`, {
        icon: iconKey('achievements'),
        color: UI_TEXT.gold,
      }),
    );
    bus.on('BuildingCompleted', ({ objectId }) => {
      const object = session.world.get(objectId);
      if (!object) return;
      this.push(`${catalog.get(object.itemId).name} is ready to use!`, { icon: iconKey('hammer') });
    });
    bus.on('SaveFailed', () => {
      const now = scene.time.now;
      if (now - this.lastSaveWarning < SAVE_WARNING_GAP_MS) return;
      this.lastSaveWarning = now;
      this.push('Could not save. Browser storage may be full or blocked', {
        icon: iconKey('save'),
        color: UI_TEXT.danger,
      });
    });
    bus.on('OrderExpired', ({ order }) =>
      this.push(`${order.customer}'s order expired`, {
        icon: iconKey('orders'),
        color: UI_TEXT.danger,
        sound: null,
      }),
    );
  }

  push(message: string, options: ToastOptions = {}): void {
    if (this.queue.length >= MAX_QUEUED) this.queue.shift();
    this.queue.push({ message, options });
    if (!this.busy) this.next();
  }

  private next(): void {
    const item = this.queue.shift();
    if (!item) {
      this.busy = false;
      return;
    }
    this.busy = true;
    this.toasts.show(item.message, item.options);
    this.scene.time.delayedCall(GAP_MS, () => this.next());
  }
}
