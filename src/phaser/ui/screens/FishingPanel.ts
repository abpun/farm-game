import type * as Phaser from 'phaser';
import type { FishDef } from '@core/entities/content';
import type { GameSession } from '@core/GameSession';
import { DRAWER } from '../../layout';
import { formatMoney } from '../format';
import { iconImage } from '../icons';
import { itemIconKey } from '../itemIcons';
import { chipRow, fitText, slotRow } from '../rows';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Drawer } from '../widgets/Drawer';
import { PagedList } from '../widgets/PagedList';
import { BAR_COLORS, ProgressBar } from '../widgets/ProgressBar';
import type { ToastManager } from '../widgets/ToastManager';

const TAB_HEIGHT = UI_PX * 14;
const CHIP_HEIGHT = UI_PX * 15;
const LINE = UI_PX * 10;
const CAST_HEIGHT = UI_PX * 26;
const ROW_HEIGHT = UI_PX * 20;
const ROW_GAP = UI_PX * 2;
const PREVIEW_ICON = UI_PX * 12;
const REFRESH_MS = 100;
const BLINK_MS = 160;

const RARITY_COLORS: Record<string, string> = {
  common: UI_TEXT.muted,
  uncommon: UI_TEXT.good,
  rare: '#3b6fb6',
  legendary: '#c07a10',
};

// Fishing drawer: pick a spot and bait, cast, then reel in while the bobber is down.
export class FishingPanel {
  readonly drawer: Drawer;
  private readonly fishPage: Phaser.GameObjects.Container;
  private readonly journalPage: Phaser.GameObjects.Container;
  private readonly tabs: Map<string, Button>;
  private readonly spotButton: Button;
  private readonly baitChips: Map<string, Button>;
  private readonly spotText: Phaser.GameObjects.Text;
  private readonly rodText: Phaser.GameObjects.Text;
  private readonly rodButton: Button;
  private readonly xpBar: ProgressBar;
  private readonly castButton: Button;
  private readonly status: Phaser.GameObjects.Text;
  private readonly preview: Phaser.GameObjects.Container;
  private readonly journal: PagedList<FishDef>;
  private spotId = 'pier';
  private baitId: string | null = null;
  private previewKey = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly toasts: ToastManager,
    x: number,
    y: number,
    openChart: (spotId: string) => void,
  ) {
    this.drawer = new Drawer(scene, x, y, DRAWER.width, DRAWER.height, 'Fishing', 'right');
    const page = this.drawer.content;
    const width = this.drawer.innerWidth;
    this.tabs = chipRow(
      scene,
      page,
      0,
      width,
      TAB_HEIGHT,
      [
        { id: 'fish', label: 'Fish', icon: iconKey('fishing') },
        { id: 'journal', label: 'Journal', icon: iconKey('quests') },
      ],
      (id) => this.showTab(id),
    );
    const top = TAB_HEIGHT + UI_PX * 4;
    this.fishPage = scene.add.container(0, top);
    this.journalPage = scene.add.container(0, top);
    page.add([this.fishPage, this.journalPage]);

    // Eight spots don't fit as chips; the sea chart is the one place to pick where to fish.
    this.spotButton = new Button(scene, 0, 0, {
      width,
      height: CHIP_HEIGHT,
      label: '',
      icon: iconKey('compass'),
      iconSize: UI_PX * 8,
      fontSize: FONT_SIZE.small,
      align: 'center',
      sound: null,
      onClick: () => openChart(this.spotId),
    });
    this.fishPage.add(this.spotButton);
    let cursor = CHIP_HEIGHT + UI_PX * 2;
    this.spotText = scene.add.text(0, cursor, '', uiText(FONT_SIZE.small, UI_TEXT.muted));
    cursor += LINE;
    this.rodText = scene.add.text(0, cursor + UI_PX * 2, '', uiText(FONT_SIZE.body));
    this.rodButton = new Button(scene, width - UI_PX * 60, cursor, {
      width: UI_PX * 60,
      height: UI_PX * 14,
      label: '',
      fontSize: FONT_SIZE.small,
      align: 'center',
      onClick: () => this.upgradeRod(),
    });
    cursor += UI_PX * 16;
    this.xpBar = new ProgressBar(scene, 0, cursor, width, UI_PX * 5, BAR_COLORS.water);
    cursor += UI_PX * 8;
    const baitLabel = scene.add.text(0, cursor, 'Bait', uiText(FONT_SIZE.small, UI_TEXT.muted));
    cursor += UI_PX * 8;
    const baits = [
      { id: 'none', label: 'No bait' },
      ...session.fishing.baits().map((b) => ({
        id: b.item,
        icon: itemIconKey(session.content, b.item),
        label: '',
      })),
    ];
    this.baitChips = chipRow(scene, this.fishPage, cursor, width, CHIP_HEIGHT, baits, (id) => {
      this.baitId = id === 'none' ? null : id;
      this.refresh();
    });
    cursor += CHIP_HEIGHT + UI_PX * 4;
    this.castButton = new Button(scene, 0, cursor, {
      width,
      height: CAST_HEIGHT,
      label: 'Cast line',
      icon: iconKey('fishing'),
      iconSize: UI_PX * 12,
      fontSize: FONT_SIZE.big,
      align: 'center',
      onClick: () => this.castOrReel(),
    });
    cursor += CAST_HEIGHT + UI_PX * 3;
    this.status = scene.add
      .text(width / 2, cursor, '', {
        ...uiText(FONT_SIZE.body),
        align: 'center',
        wordWrap: { width },
      })
      .setOrigin(0.5, 0);
    cursor += UI_PX * 22;
    const previewLabel = scene.add.text(
      0,
      cursor,
      'Biting here',
      uiText(FONT_SIZE.small, UI_TEXT.muted),
    );
    this.preview = scene.add.container(0, cursor + UI_PX * 9);
    this.fishPage.add([
      this.spotText,
      this.rodText,
      this.rodButton,
      this.xpBar,
      baitLabel,
      this.castButton,
      this.status,
      previewLabel,
      this.preview,
    ]);

    this.journal = new PagedList<FishDef>(
      scene,
      0,
      0,
      width,
      this.drawer.innerHeight - top,
      ROW_HEIGHT,
      ROW_GAP,
      (fish, w, h) => this.journalRow(fish, w, h),
    );
    this.journalPage.add(this.journal);

    session.bus.on('FishEscaped', ({ reason }) => {
      if (reason === 'late')
        this.setStatus('It got away! Reel in when the bobber dips.', UI_TEXT.danger);
    });
    session.bus.on('FishCaught', () => this.journal.setItems(session.content.fish.all()));
    this.drawer.on('drawer-opened', () => this.refresh());
    scene.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });
    this.showTab('fish');
    this.selectSpot(this.spotId);
  }

  /** Opens the drawer on a spot (e.g. from tapping its pier). */
  focusSpot(spotId: string): void {
    this.selectSpot(spotId);
    this.showTab('fish');
  }

  private showTab(id: string): void {
    this.tabs.forEach((tab, tabId) => tab.setSelected(tabId === id));
    this.fishPage.setVisible(id === 'fish');
    this.journalPage.setVisible(id === 'journal');
    if (id === 'journal') this.journal.setItems(this.session.content.fish.all());
  }

  private selectSpot(spotId: string): void {
    if (this.session.fishing.cast()) return;
    this.spotId = spotId;
    this.previewKey = '';
    this.refresh(true);
  }

  private castOrReel(): void {
    const { fishing, content } = this.session;
    if (!fishing.cast()) {
      const result = fishing.startCast(this.spotId, this.baitId);
      if (result.ok) this.setStatus('Waiting for a bite…', UI_TEXT.muted);
      else this.setStatus(result.reason, UI_TEXT.danger);
      return;
    }
    const result = fishing.reel();
    if (!result.ok) {
      this.setStatus(result.reason, UI_TEXT.danger);
      return;
    }
    const fish = content.fish.get(result.fishId);
    const rarity = content.config.fishing.rarities.find((r) => r.id === fish.rarity)?.name ?? '';
    this.setStatus(`Caught a ${fish.name}! (${rarity})`, UI_TEXT.good);
    this.toasts.show(
      result.firstCatch ? `New fish discovered: ${fish.name}!` : `Caught a ${fish.name}`,
      { icon: itemIconKey(content, fish.id), color: UI_TEXT.gold },
    );
  }

  private upgradeRod(): void {
    const next = this.session.fishing.nextRod();
    const result = this.session.fishing.upgradeRod();
    this.toasts.show(result.ok ? `Upgraded to the ${next?.name}!` : result.reason, {
      icon: iconKey('fishing'),
      color: result.ok ? UI_TEXT.gold : UI_TEXT.danger,
    });
  }

  private setStatus(message: string, color: string): void {
    this.status.setText(message).setColor(color);
  }

  private refresh(force = false): void {
    if (!force && !this.drawer.isOpen) return;
    const { fishing, inventory, economy, content } = this.session;
    const cast = fishing.cast();
    const spotId = cast?.spotId ?? this.spotId;
    const spot = content.spots.get(spotId);
    this.spotButton.setLabel(`${spot.name} · change spot`).setEnabled(!cast);
    const blocker = fishing.spotBlocker(spotId);
    this.spotText.setText(blocker ? `${spot.name}: ${blocker}` : spot.description);
    this.spotText.setColor(blocker ? UI_TEXT.danger : UI_TEXT.muted);

    const rod = fishing.rod();
    const [earned, needed] = fishing.levelProgress();
    this.rodText.setText(`${rod.name} · Fishing Lv ${fishing.level()}`);
    fitText(this.rodText, this.drawer.innerWidth - UI_PX * 64);
    this.xpBar.setProgress(needed > 0 ? earned / needed : 1);
    const next = fishing.nextRod();
    if (!next) this.rodButton.setLabel('Best rod').setEnabled(false);
    else if (fishing.level() < next.fishingLevel) {
      this.rodButton.setLabel(`Next rod: Lv ${next.fishingLevel}`).setEnabled(false);
    } else {
      this.rodButton
        .setLabel(`${next.name} $${formatMoney(next.price)}`)
        .setEnabled(economy.canAfford(next.price));
    }

    this.baitChips.forEach((chip, id) => {
      const bait = fishing.baits().find((b) => b.item === id);
      const count = bait ? inventory.count(id) : 0;
      if (bait) chip.setLabel(`×${count}`);
      const usable = !bait || (count > 0 && fishing.level() >= bait.fishingLevel);
      if (!usable && this.baitId === id) this.baitId = null;
      chip.setSelected((this.baitId ?? 'none') === id).setEnabled(usable && !cast);
    });

    const phase = fishing.phase();
    const blink = Math.floor(this.scene.time.now / BLINK_MS) % 2 === 0;
    if (phase === 'idle') this.castButton.setLabel('Cast line').setSelected(false);
    else if (phase === 'waiting') this.castButton.setLabel('Waiting…').setSelected(false);
    else this.castButton.setLabel('Reel in!').setSelected(blink);
    this.castButton.setEnabled(phase !== 'idle' || blocker === null);
    if (phase === 'bite') this.setStatus('A bite! Reel in now!', UI_TEXT.good);
    this.drawPreview(spotId);
  }

  private drawPreview(spotId: string): void {
    const fish = this.session.fishing.catchable(spotId);
    const journal = this.session.state.fishing.journal;
    const key = `${spotId}:${fish.map((f) => `${f.id}${journal[f.id] ? '+' : '-'}`).join(',')}`;
    if (key === this.previewKey) return;
    this.previewKey = key;
    this.preview.removeAll(true);
    fish.forEach((f, index) => {
      const known = Boolean(journal[f.id]);
      const icon = iconImage(
        this.scene,
        known ? itemIconKey(this.session.content, f.id) : iconKey('lock'),
        index * (PREVIEW_ICON + UI_PX * 3) + PREVIEW_ICON / 2,
        PREVIEW_ICON / 2,
        PREVIEW_ICON,
      );
      this.preview.add(icon);
    });
  }

  private journalRow(fish: FishDef, width: number, height: number) {
    const record = this.session.state.fishing.journal[fish.id];
    const rarity = this.session.content.config.fishing.rarities.find((r) => r.id === fish.rarity);
    const spots = fish.spots.map((id) => this.session.content.spots.get(id).name).join(', ');
    return slotRow(this.scene, width, height, {
      icon: record ? itemIconKey(this.session.content, fish.id) : iconKey('lock'),
      title: record ? `${fish.name} ×${record.caught}` : '???',
      titleColor: record ? UI_TEXT.dark : UI_TEXT.muted,
      subtitle: record
        ? `${rarity?.name} · $${fish.sellPrice} · ${spots}`
        : `${rarity?.name} · fishing Lv ${fish.fishingLevel} · ${spots}`,
      subtitleColor: RARITY_COLORS[fish.rarity],
    });
  }
}
