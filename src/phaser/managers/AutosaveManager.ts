import type * as Phaser from 'phaser';
import type { GameEvents } from '@core/events/GameEvents';
import type { GameSession } from '@core/GameSession';

const MS_PER_SEC = 1000;
const ACTION_DEBOUNCE_MS = 1500;
const SAVE_TRIGGERS: Array<keyof GameEvents> = [
  'CropPlanted',
  'CropWatered',
  'CropHarvested',
  'ItemSold',
  'ItemBought',
  'ObjectPlaced',
  'ObjectRemoved',
  'LevelUp',
  'LandExpanded',
  'StorageUpgraded',
  'BuildingUpgraded',
  'ProductionStarted',
  'ProductionCollected',
  'AnimalBought',
  'AnimalsFed',
  'AnimalProductsCollected',
  'FishingCast',
  'FishCaught',
  'FishEscaped',
  'RodUpgraded',
  'OrdersChanged',
  'AchievementCompleted',
  'AchievementClaimed',
];
// Saved at once so a quick reload can never re-roll a cast that is already decided.
const IMMEDIATE: ReadonlySet<keyof GameEvents> = new Set(['FishingCast', 'FishCaught']);

// Saves shortly after player actions, on a slow interval, and when the tab hides or closes.
export class AutosaveManager {
  private pending: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
  ) {
    const interval = scene.time.addEvent({
      delay: session.config.farm.autosaveIntervalSec * MS_PER_SEC,
      loop: true,
      callback: () => this.saveNow(),
    });
    const unsubscribers = SAVE_TRIGGERS.map((event) =>
      session.bus.on(event, () => (IMMEDIATE.has(event) ? this.saveNow() : this.scheduleSave())),
    );
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
    scene.events.once('shutdown', () => {
      interval.remove();
      unsubscribers.forEach((off) => off());
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      window.removeEventListener('pagehide', this.onPageHide);
    });
  }

  saveNow(): void {
    this.pending?.remove();
    this.pending = null;
    this.session.save();
  }

  private scheduleSave(): void {
    if (this.pending) return;
    this.pending = this.scene.time.delayedCall(ACTION_DEBOUNCE_MS, () => this.saveNow());
  }

  private readonly onVisibilityChange = () => {
    if (document.hidden) this.saveNow();
  };

  private readonly onPageHide = () => this.saveNow();
}
