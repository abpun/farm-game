import * as Phaser from 'phaser';
import { AudioDirector } from '../audio/AudioDirector';
import { UiFx } from '../fx/UiFx';
import { DOCK, DRAWER, TOAST_ANCHOR } from '../layout';
import { getSession, getTools, getUiBus } from '../session';
import { formatDuration } from '../ui/format';
import { BarnPanel } from '../ui/screens/BarnPanel';
import { openBuildingDialog } from '../ui/screens/BuildingDialog';
import { CraftingPanel } from '../ui/screens/CraftingPanel';
import { DOCK_ENTRIES, Docks, drawerX, type DockEntry } from '../ui/screens/Docks';
import { FishingPanel } from '../ui/screens/FishingPanel';
import { Hud } from '../ui/screens/Hud';
import { openLandDialog } from '../ui/screens/LandDialog';
import { MarketPanel } from '../ui/screens/MarketPanel';
import { exploreDiscovery, openPlacesMenu } from '../ui/screens/Exploration';
import { Notifications } from '../ui/screens/Notifications';
import { OrdersPanel } from '../ui/screens/OrdersPanel';
import { openSeaChart } from '../ui/screens/SeaChart';
import { openSettingsMenu } from '../ui/screens/SettingsMenu';
import { ToolBanner } from '../ui/screens/ToolBanner';
import { TrophiesPanel } from '../ui/screens/TrophiesPanel';
import { iconKey, seasonIconKey } from '../ui/uiTextures';
import { UI_TEXT } from '../ui/uiTheme';
import { Dialog } from '../ui/widgets/Dialog';
import { DRAWER_EVENTS, type Drawer } from '../ui/widgets/Drawer';
import { ToastManager } from '../ui/widgets/ToastManager';

const WELCOME_BACK_MIN_SEC = 60;
const MS_PER_SEC = 1000;
const BADGE_REFRESH_MS = 500;

export class UIScene extends Phaser.Scene {
  private hud!: Hud;
  private audio!: AudioDirector;
  private drawers = new Map<string, Drawer>();

  constructor() {
    super('UI');
  }

  create(): void {
    const session = getSession(this);
    const tools = getTools(this);
    const uiBus = getUiBus(this);
    const toasts = new ToastManager(this, TOAST_ANCHOR);
    this.audio = new AudioDirector(this, session);
    this.hud = new Hud(
      this,
      session,
      () => openSettingsMenu(this, session, toasts),
      () => openPlacesMenu(this),
    );
    const openBuilding = (objectId: number) => {
      this.closeDrawers();
      openBuildingDialog(this, session, toasts, objectId);
    };

    const right = drawerX('right', DRAWER.width);
    const left = drawerX('left', DRAWER.width);
    const goFishing = (spotId: string) => {
      fishing.focusSpot(spotId);
      const spot = session.content.spots.get(spotId);
      uiBus.emit('FocusMap', { featureId: spot.access === 'boat' ? 'harbor' : `spot-${spotId}` });
      if (!fishing.drawer.isOpen) this.toggleDrawer('fishing');
    };
    const chart = (focus?: string) => {
      this.closeDrawers();
      openSeaChart(this, session, toasts, goFishing, focus);
    };
    const fishing = new FishingPanel(this, session, toasts, right, DOCK.top, chart);
    const orders = new OrdersPanel(this, session, toasts, right, DOCK.top);
    const trophies = new TrophiesPanel(this, session, toasts, left, DOCK.top);
    this.drawers.set(
      'market',
      new MarketPanel(this, session, tools, toasts, right, DOCK.top).drawer,
    );
    this.drawers.set('barn', new BarnPanel(this, session, toasts, right, DOCK.top).drawer);
    this.drawers.set(
      'crafting',
      new CraftingPanel(this, session, openBuilding, right, DOCK.top).drawer,
    );
    this.drawers.set('orders', orders.drawer);
    this.drawers.set('fishing', fishing.drawer);
    this.drawers.set('achievements', trophies.drawer);

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
    fishing.drawer.on(DRAWER_EVENTS.opened, () => this.audio.setFishing(true));
    fishing.drawer.on(DRAWER_EVENTS.closed, () => this.audio.setFishing(false));
    const updateBadges = () => {
      docks.setBadge('achievements', session.achievements.unclaimedCount());
      docks.setBadge('orders', orders.deliverableCount());
      docks.setBadge('crafting', this.readyBuildings());
    };
    this.time.addEvent({ delay: BADGE_REFRESH_MS, loop: true, callback: updateBadges });
    updateBadges();
    new UiFx(this, session, this.hud, docks);

    uiBus.on('OpenBuilding', ({ objectId }) => openBuilding(objectId));
    uiBus.on('OpenFishing', ({ spotId }) => {
      fishing.focusSpot(spotId);
      if (!fishing.drawer.isOpen) this.toggleDrawer('fishing');
    });
    uiBus.on('OpenLand', () => openLandDialog(this, session, toasts));
    uiBus.on('OpenHarbor', () => chart());
    uiBus.on('Discover', ({ id }) => exploreDiscovery(session, toasts, id));
    uiBus.on('OpenMine', () => {
      if (!session.mining.isUnlocked()) {
        toasts.show(`The mine opens at level ${session.mining.unlockLevel()}`, {
          icon: iconKey('pickaxe'),
          color: UI_TEXT.danger,
        });
        return;
      }
      this.enterMine();
    });
    uiBus.on('LeaveMine', () => this.leaveMine());
    uiBus.on('FocusMap', () => this.leaveMine());

    new ToolBanner(this, session, tools);
    new Notifications(this, session, toasts);
    session.bus.on('SeasonChanged', () => {
      const season = session.seasons.current();
      toasts.show(`${season.name} has arrived!`, {
        icon: seasonIconKey(season.id),
        color: UI_TEXT.gold,
      });
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      tools.clear();
      Dialog.closeAll();
      this.closeDrawers();
    });

    if (session.offlineSeconds >= WELCOME_BACK_MIN_SEC) {
      toasts.show(`Welcome back! ${formatDuration(session.offlineSeconds)} of growth`, {
        icon: iconKey('clock'),
        color: UI_TEXT.gold,
      });
    }
  }

  override update(_time: number, deltaMs: number): void {
    getSession(this).update(deltaMs / MS_PER_SEC);
    this.hud.update();
    this.audio.update(deltaMs);
  }

  // The farm sleeps (no rendering or input) while the mine scene runs between it and the HUD.
  private enterMine(): void {
    if (this.scene.isActive('Mine')) return;
    Dialog.closeAll();
    this.closeDrawers();
    this.scene.sleep('Farm');
    this.scene.launch('Mine');
    this.scene.bringToTop('UI');
    this.audio.setPlace('mine');
  }

  private leaveMine(): void {
    if (!this.scene.isActive('Mine')) return;
    this.scene.stop('Mine');
    this.scene.wake('Farm');
    this.audio.setPlace(null);
  }

  /** Buildings with something to collect, for the Crafting badge. */
  private readyBuildings(): number {
    const { buildings, production, ranch } = getSession(this);
    return buildings.ids().filter((id) => {
      if (!buildings.isOperational(id)) return false;
      return production.readyCount(id) > 0 || ranch.countByStatus(id, 'ready') > 0;
    }).length;
  }

  private closeDrawers(): void {
    this.drawers.forEach((drawer) => drawer.close());
  }

  // One drawer at a time: opening one closes the others.
  private toggleDrawer(id: string): void {
    this.drawers.forEach((drawer, drawerId) => {
      if (drawerId === id) drawer.toggle();
      else drawer.close();
    });
  }
}
