import * as Phaser from 'phaser';
import { DOCK, DRAWER, TOAST_ANCHOR } from '../layout';
import { getSession, getTools } from '../session';
import { formatDuration } from '../ui/format';
import { BarnPanel } from '../ui/screens/BarnPanel';
import { DOCK_ENTRIES, Docks, drawerX, type DockEntry } from '../ui/screens/Docks';
import { Hud } from '../ui/screens/Hud';
import { MarketPanel } from '../ui/screens/MarketPanel';
import { openSettingsMenu } from '../ui/screens/SettingsMenu';
import { ToolBanner } from '../ui/screens/ToolBanner';
import { iconKey, seasonIconKey } from '../ui/uiTextures';
import { UI_TEXT } from '../ui/uiTheme';
import { DRAWER_EVENTS, type Drawer } from '../ui/widgets/Drawer';
import { ToastManager } from '../ui/widgets/ToastManager';

const WELCOME_BACK_MIN_SEC = 60;

export class UIScene extends Phaser.Scene {
  private hud!: Hud;
  private drawers = new Map<string, Drawer>();

  constructor() {
    super('UI');
  }

  create(): void {
    const session = getSession(this);
    const tools = getTools(this);
    const toasts = new ToastManager(this, TOAST_ANCHOR);
    this.hud = new Hud(this, session, () => openSettingsMenu(this, session, toasts));

    const x = drawerX('right', DRAWER.width);
    this.drawers.set('market', new MarketPanel(this, session, tools, x, DOCK.top).drawer);
    this.drawers.set('barn', new BarnPanel(this, session, toasts, x, DOCK.top).drawer);

    const entries: DockEntry[] = DOCK_ENTRIES.map((entry) =>
      this.drawers.has(entry.id) ? { ...entry, onOpen: () => this.toggleDrawer(entry.id) } : entry,
    );
    const docks = new Docks(this, entries, (entry) =>
      toasts.show(`${entry.label}: coming soon`, { icon: iconKey(entry.icon) }),
    );
    this.drawers.forEach((drawer, id) => {
      drawer.on(DRAWER_EVENTS.opened, () => docks.setActive(id));
      drawer.on(DRAWER_EVENTS.closed, () => docks.setActive(null));
    });

    new ToolBanner(this, session, tools);
    session.bus.on('SeasonChanged', () => {
      const season = session.seasons.current();
      toasts.show(`${season.name} has arrived!`, {
        icon: seasonIconKey(season.id),
        color: UI_TEXT.gold,
      });
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      tools.clear();
      this.drawers.forEach((drawer) => drawer.close());
    });

    if (session.offlineSeconds >= WELCOME_BACK_MIN_SEC) {
      toasts.show(`Welcome back! ${formatDuration(session.offlineSeconds)} of growth`, {
        icon: iconKey('clock'),
        color: UI_TEXT.gold,
      });
    }
  }

  override update(): void {
    this.hud.update();
  }

  // One drawer at a time: opening one closes the others.
  private toggleDrawer(id: string): void {
    this.drawers.forEach((drawer, drawerId) => {
      if (drawerId === id) drawer.toggle();
      else drawer.close();
    });
  }
}
