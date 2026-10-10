import type * as Phaser from 'phaser';
import type { DiscoveryKind } from '@core/entities/content';
import type { GameSession } from '@core/GameSession';
import { getUiBus } from '../../session';
import { iconKey, type IconName } from '../uiTextures';
import { UI_TEXT } from '../uiTheme';
import { Modal } from '../widgets/Modal';
import type { ToastManager } from '../widgets/ToastManager';
import { describeReward } from './TrophiesPanel';

const FOUND: Record<DiscoveryKind, (name: string) => string> = {
  chest: (name) => `Found the ${name.toLowerCase()}!`,
  viewpoint: (name) => `${name}: what a view!`,
  obstacle: (name) => `Cleared the ${name.toLowerCase()}!`,
};
const AGAIN: Record<DiscoveryKind, (name: string) => string> = {
  chest: () => 'Already emptied',
  viewpoint: (name) => `${name} · a fine view, as ever`,
  obstacle: () => 'The trail is clear now',
};
const ICONS: Record<DiscoveryKind, IconName> = {
  chest: 'chest',
  viewpoint: 'compass',
  obstacle: 'pickaxe',
};

/** Opens, admires or clears a discovery, with a toast that says what it gave. */
export function exploreDiscovery(session: GameSession, toasts: ToastManager, id: string): void {
  const discovery = session.content.discoveries.find(id);
  if (!discovery) return;
  const icon = iconKey(ICONS[discovery.kind]);
  if (session.exploration.isFound(id)) {
    toasts.show(AGAIN[discovery.kind](discovery.name), { icon, sound: null });
    return;
  }
  const result = session.exploration.discover(id);
  if (!result.ok) {
    toasts.show(`${discovery.name}: ${result.reason}`, { icon, color: UI_TEXT.danger });
    return;
  }
  const reward = describeReward(session, discovery.reward);
  toasts.show(`${FOUND[discovery.kind](discovery.name)} ${reward}`, {
    icon,
    color: UI_TEXT.gold,
    sound: null,
  });
}

const PLACES: Array<{ featureId: string; label: string; icon: IconName }> = [
  { featureId: 'farm', label: 'Farm', icon: 'barn' },
  { featureId: 'mine-entrance', label: 'Mine', icon: 'pickaxe' },
  { featureId: 'waterfall', label: 'Waterfall Pond', icon: 'fishing' },
  { featureId: 'harbor', label: 'Harbor', icon: 'boat' },
  { featureId: 'lighthouse', label: 'Lighthouse', icon: 'compass' },
  { featureId: 'spot-rocks', label: 'Rocky Point', icon: 'fishing' },
];

/** Quick camera trips to the valley's main places. */
export function openPlacesMenu(scene: Phaser.Scene): void {
  Modal.open(scene, {
    title: 'Places',
    actions: PLACES.map((place) => ({
      label: place.label,
      icon: iconKey(place.icon),
      sound: 'click',
      onClick: () => getUiBus(scene).emit('FocusMap', { featureId: place.featureId }),
    })),
  });
}
