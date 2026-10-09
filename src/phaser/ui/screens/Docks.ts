import type * as Phaser from 'phaser';
import { DOCK, GAME_WIDTH } from '../../layout';
import { iconKey, type IconName } from '../uiTextures';
import { FONT_SIZE, UI_PX, uiTextOnWood } from '../uiTheme';
import { Button } from '../widgets/Button';
import type { DrawerSide } from '../widgets/Drawer';

export interface DockEntry {
  id: string;
  label: string;
  icon: IconName;
  side: DrawerSide;
  /** Omitted for features that are announced but not built yet. */
  onOpen?: () => void;
}

// Every planned feature gets a dock icon now; the ones without onOpen show "Coming soon".
export const DOCK_ENTRIES: Omit<DockEntry, 'onOpen'>[] = [
  { id: 'market', label: 'Market', icon: 'market', side: 'right' },
  { id: 'barn', label: 'Barn', icon: 'barn', side: 'right' },
  { id: 'crafting', label: 'Crafting', icon: 'crafting', side: 'right' },
  { id: 'orders', label: 'Orders', icon: 'orders', side: 'right' },
  { id: 'fishing', label: 'Fishing', icon: 'fishing', side: 'right' },
  { id: 'farmhands', label: 'Farmhands', icon: 'farmhands', side: 'left' },
  { id: 'quests', label: 'Quests', icon: 'quests', side: 'left' },
  { id: 'achievements', label: 'Trophies', icon: 'achievements', side: 'left' },
  { id: 'friends', label: 'Friends', icon: 'friends', side: 'left' },
  { id: 'mail', label: 'Mail', icon: 'mail', side: 'left' },
];

const LOCK_SCALE = 2;
const DOCK_DEPTH = 600;

export const dockX = (side: DrawerSide) =>
  side === 'left' ? DOCK.margin : GAME_WIDTH - DOCK.margin - DOCK.button;

/** Left edge for a drawer that opens next to the given dock. */
export const drawerX = (side: DrawerSide, width: number) =>
  side === 'left'
    ? DOCK.margin + DOCK.button + DOCK.margin
    : GAME_WIDTH - DOCK.margin - DOCK.button - DOCK.margin - width;

export class Docks {
  readonly buttons = new Map<string, Button>();

  constructor(scene: Phaser.Scene, entries: DockEntry[], onComingSoon: (entry: DockEntry) => void) {
    const slots: Record<DrawerSide, number> = { left: 0, right: 0 };
    for (const entry of entries) {
      const index = slots[entry.side]++;
      const x = dockX(entry.side);
      const y = DOCK.top + index * (DOCK.button + DOCK.labelHeight + DOCK.gap);
      const button = new Button(scene, x, y, {
        width: DOCK.button,
        height: DOCK.button,
        icon: iconKey(entry.icon),
        iconSize: UI_PX * 12,
        align: 'center',
        onClick: () => (entry.onOpen ? entry.onOpen() : onComingSoon(entry)),
      }).setDepth(DOCK_DEPTH);
      const label = scene.add
        .text(
          x + DOCK.button / 2,
          y + DOCK.button + UI_PX,
          entry.label,
          uiTextOnWood(FONT_SIZE.small),
        )
        .setOrigin(0.5, 0)
        .setDepth(DOCK_DEPTH);
      if (!entry.onOpen) {
        button.setAlpha(0.75);
        label.setAlpha(0.75);
        scene.add
          .image(x + DOCK.button - UI_PX * 2, y + DOCK.button - UI_PX * 2, iconKey('lock'))
          .setOrigin(1)
          .setScale(LOCK_SCALE)
          .setDepth(DOCK_DEPTH + 1);
      }
      this.buttons.set(entry.id, button);
    }
  }

  setActive(id: string | null): void {
    this.buttons.forEach((button, buttonId) => button.setSelected(buttonId === id));
  }
}
