import type * as Phaser from 'phaser';
import type { SpotDef } from '@core/entities/content';
import type { GameSession } from '@core/GameSession';
import { describeQuantities } from '@core/services/rewards';
import { bakeBanners, bakeChart, bannerKey, CHART_KEY, chartPoint } from '../../art/ChartArtist';
import { WORLD, type MapPoint } from '../../map/WorldMap';
import { formatMoney } from '../format';
import { iconImage } from '../icons';
import { itemIconKey } from '../itemIcons';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Dialog } from '../widgets/Dialog';
import type { ToastManager } from '../widgets/ToastManager';

const WIDTH = UI_PX * 330;
const HEIGHT = UI_PX * 214;
const MARKER = UI_PX * 13;
const PANE_GAP = UI_PX * 6;
const FISH_ICON = UI_PX * 10;
const ROUTE_DOT = UI_PX;
const DIFFICULTY: Array<[number, string]> = [
  [1.02, 'Calm'],
  [1.12, 'Brisk'],
  [1.22, 'Tricky'],
  [Infinity, 'Wild'],
];

/** Fish (or sail) at the chosen spot. */
export type GoFishing = (spotId: string) => void;

// The harbor's sea chart: every fishing spot on one map, with what it takes to get there.
export function openSeaChart(
  scene: Phaser.Scene,
  session: GameSession,
  toasts: ToastManager,
  goFishing: GoFishing,
  focus?: string,
): void {
  bakeChart(scene, WORLD);
  bakeBanners(scene);
  const dialog = Dialog.open(scene, { title: 'Sea Chart', width: WIDTH, height: HEIGHT });
  const page = dialog.content;
  const chart = scene.add.image(0, 0, CHART_KEY).setOrigin(0).setScale(UI_PX);
  page.add(chart);
  const routes = scene.add.graphics();
  page.add(routes);
  const paneX = chart.displayWidth + PANE_GAP;
  const paneWidth = dialog.innerWidth - paneX;
  const pane = scene.add.container(paneX, 0);
  page.add(pane);

  const spots = session.fishing.spots();
  let selected = focus ?? spots[0]?.id ?? '';
  const markers = new Map<string, Button>();
  const harbor = locate('pier');
  for (const spot of spots) {
    const at = chartAt(locate(spot.id), chart.displayWidth);
    if (spot.access === 'boat' && harbor)
      drawRoute(routes, chartAt(harbor, chart.displayWidth), at);
    const marker = new Button(scene, at.x - MARKER / 2, at.y - MARKER / 2, {
      width: MARKER,
      height: MARKER,
      icon: iconKey('fishing'),
      iconSize: UI_PX * 8,
      align: 'center',
      sound: 'tab',
      onClick: () => {
        selected = spot.id;
        dialog.refresh();
      },
    });
    markers.set(spot.id, marker);
    page.add(marker);
  }

  const boatY = chart.displayHeight + UI_PX * 4;
  const boatText = scene.add.text(0, boatY + UI_PX * 3, '', uiText(FONT_SIZE.body));
  const boatButton = new Button(scene, 0, boatY + UI_PX * 14, {
    width: chart.displayWidth,
    height: UI_PX * 16,
    label: '',
    icon: iconKey('boat'),
    iconSize: UI_PX * 9,
    fontSize: FONT_SIZE.small,
    align: 'center',
    sound: null,
    onClick: () => {
      const next = session.fishing.nextBoat();
      const result = session.fishing.upgradeBoat();
      toasts.show(result.ok ? `Your ${next?.name} is moored at the harbor!` : result.reason, {
        icon: iconKey('boat'),
        color: result.ok ? UI_TEXT.gold : UI_TEXT.danger,
      });
      dialog.refresh();
    },
  });
  page.add([boatText, boatButton]);

  let shown = '';
  dialog.onRefresh(() => {
    for (const [id, marker] of markers) {
      const blocker = session.fishing.spotBlocker(id);
      const spot = session.content.spots.get(id);
      const icon = !blocker ? 'fishing' : blocker.startsWith('Needs') ? 'boat' : 'lock';
      marker.setIcon(iconKey(icon)).setSelected(id === selected);
      marker.setAlpha(blocker && spot.access === 'boat' ? 0.85 : 1);
    }
    // Rebuilding the pane mid-press would swallow the click, so redraw only on change.
    const known = Object.keys(session.state.fishing.journal).length;
    const signature = `${selected}:${session.fishing.spotBlocker(selected)}:${known}`;
    if (signature !== shown) {
      shown = signature;
      drawPane(scene, session, pane, paneWidth, session.content.spots.get(selected), () => {
        dialog.close();
        goFishing(selected);
      });
    }
    const boat = session.fishing.boat();
    const next = session.fishing.nextBoat();
    boatText.setText(`Your boat: ${boat?.name ?? 'none yet'}`);
    if (!next) {
      boatButton.setLabel('Finest boat in the harbor').setEnabled(false);
    } else {
      const materials = Object.keys(next.materials).length
        ? ` + ${describeQuantities(session, next.materials)}`
        : '';
      const locked = !session.progression.isUnlocked(next.unlockLevel);
      boatButton
        .setLabel(
          locked
            ? `${next.name} unlocks at level ${next.unlockLevel}`
            : `Buy the ${next.name}: $${formatMoney(next.price)}${materials}`,
        )
        .setEnabled(!locked);
    }
  });
}

function drawPane(
  scene: Phaser.Scene,
  session: GameSession,
  pane: Phaser.GameObjects.Container,
  width: number,
  spot: SpotDef,
  go: () => void,
): void {
  pane.removeAll(true);
  const banner = scene.add.image(0, 0, bannerKey(spot.biome)).setOrigin(0).setScale(UI_PX);
  let y = banner.displayHeight + UI_PX * 3;
  const blocker = session.fishing.spotBlocker(spot.id);
  const lines = [
    spot.access === 'boat'
      ? `By boat · needs a ${boatName(session, spot.boatTier)}`
      : 'On foot · tap it on the map too',
    `Water: ${DIFFICULTY.find(([max]) => spot.difficulty <= max)?.[1] ?? 'Calm'} · from level ${spot.unlockLevel}`,
  ];
  const title = scene.add.text(0, y, spot.name, uiText(FONT_SIZE.title));
  y += UI_PX * 11;
  const description = scene.add.text(0, y, spot.description, {
    ...uiText(FONT_SIZE.small, UI_TEXT.muted),
    wordWrap: { width },
  });
  y += description.height + UI_PX * 2;
  const info = scene.add.text(0, y, lines.join('\n'), {
    ...uiText(FONT_SIZE.small),
    lineSpacing: UI_PX,
  });
  y += info.height + UI_PX * 4;
  pane.add([banner, title, description, info]);

  const journal = session.state.fishing.journal;
  const fish = session.content.fish.all().filter((f) => f.spots.includes(spot.id));
  fish.forEach((f, index) => {
    const known = Boolean(journal[f.id]);
    const x = (index % 7) * (FISH_ICON + UI_PX * 3) + FISH_ICON / 2;
    const row = Math.floor(index / 7);
    const icon = iconImage(
      scene,
      known ? itemIconKey(session.content, f.id) : iconKey('lock'),
      x,
      y + row * (FISH_ICON + UI_PX * 2) + FISH_ICON / 2,
      FISH_ICON,
    );
    pane.add(icon);
  });
  y += Math.ceil(fish.length / 7) * (FISH_ICON + UI_PX * 2) + UI_PX * 4;
  const button = new Button(scene, 0, y, {
    width,
    height: UI_PX * 18,
    label: blocker ?? (spot.access === 'boat' ? 'Set sail' : 'Fish here'),
    icon: iconKey(spot.access === 'boat' ? 'boat' : 'fishing'),
    iconSize: UI_PX * 9,
    fontSize: FONT_SIZE.body,
    align: 'center',
    sound: 'confirm',
    onClick: go,
  }).setEnabled(blocker === null);
  pane.add(button);
}

function boatName(session: GameSession, tier: number): string {
  return session.content.boats.all().find((b) => b.tier === tier)?.name ?? 'boat';
}

/** Map position of a spot: shore spots from the map's features, boat spots out at sea. */
function locate(spotId: string): MapPoint | null {
  const feature = WORLD.features.find((f) => f.kind === 'spot' && f.spot === spotId);
  return feature ?? WORLD.seaSpots[spotId] ?? null;
}

function chartAt(point: MapPoint | null, chartWidth: number) {
  if (!point) return { x: chartWidth / 2, y: 0 };
  const p = chartPoint(point.u, point.v);
  return { x: p.x * UI_PX, y: p.y * UI_PX };
}

function drawRoute(
  g: Phaser.GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (UI_PX * 4));
  g.fillStyle(0x6b3a18);
  for (let s = 1; s < steps; s++) {
    const x = from.x + ((to.x - from.x) * s) / steps;
    const y = from.y + ((to.y - from.y) * s) / steps;
    g.fillRect(Math.round(x / UI_PX) * UI_PX, Math.round(y / UI_PX) * UI_PX, ROUTE_DOT, ROUTE_DOT);
  }
}
