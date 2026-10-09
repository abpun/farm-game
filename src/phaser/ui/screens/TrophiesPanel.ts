import type * as Phaser from 'phaser';
import type { AchievementDef, Reward } from '@core/entities/content';
import type { GameSession } from '@core/GameSession';
import { DRAWER } from '../../layout';
import { formatMoney } from '../format';
import { iconImage } from '../icons';
import { chipRow, fitText } from '../rows';
import { iconKey, type IconName } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Drawer } from '../widgets/Drawer';
import { createFrame } from '../widgets/Frame';
import { PagedList } from '../widgets/PagedList';
import { BAR_COLORS, ProgressBar } from '../widgets/ProgressBar';
import type { ToastManager } from '../widgets/ToastManager';

const HEADER_HEIGHT = UI_PX * 20;
const CHIP_HEIGHT = UI_PX * 15;
const CARD_HEIGHT = UI_PX * 30;
const CARD_GAP = UI_PX * 2;
const ICON = UI_PX * 16;
const PAD = UI_PX * 3;
const CLAIM_WIDTH = UI_PX * 28;

const CATEGORY_ICONS: Record<string, IconName> = {
  farming: 'seed',
  orchard: 'orchard',
  fishing: 'fishing',
  animals: 'chicken',
  production: 'crafting',
  deliveries: 'orders',
  economy: 'coin',
  collections: 'achievements',
};

export function describeReward(session: GameSession, reward: Reward): string {
  const parts: string[] = [];
  if (reward.coins) parts.push(`$${formatMoney(reward.coins)}`);
  if (reward.xp) parts.push(`${reward.xp}xp`);
  for (const [id, count] of Object.entries(reward.items ?? {})) {
    parts.push(`${count} ${session.content.items.name(id)}`);
  }
  for (const id of reward.unlocks ?? []) parts.push(session.catalog.get(id).name);
  return parts.join(' + ');
}

// Trophies drawer: player level, then achievements by category with one-time rewards.
export class TrophiesPanel {
  readonly drawer: Drawer;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly xpBar: ProgressBar;
  private readonly chips: Map<string, Button>;
  private readonly list: PagedList<AchievementDef>;
  private category: string;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly toasts: ToastManager,
    x: number,
    y: number,
  ) {
    this.drawer = new Drawer(scene, x, y, DRAWER.width, DRAWER.height, 'Trophies', 'left');
    const page = this.drawer.content;
    const width = this.drawer.innerWidth;
    this.levelText = scene.add.text(0, 0, '', uiText(FONT_SIZE.body));
    this.xpBar = new ProgressBar(scene, 0, UI_PX * 11, width, UI_PX * 5, BAR_COLORS.xp);
    page.add([this.levelText, this.xpBar]);
    const categories = session.config.achievements.categories;
    this.category = categories[0]?.id ?? '';
    this.chips = chipRow(
      scene,
      page,
      HEADER_HEIGHT,
      width,
      CHIP_HEIGHT,
      categories.map((c) => ({ id: c.id, icon: iconKey(CATEGORY_ICONS[c.id] ?? 'achievements') })),
      (id) => this.show(id),
    );
    const listY = HEADER_HEIGHT + CHIP_HEIGHT + UI_PX * 4;
    this.list = new PagedList<AchievementDef>(
      scene,
      0,
      listY,
      width,
      this.drawer.innerHeight - listY,
      CARD_HEIGHT,
      CARD_GAP,
      (achievement, w, h) => this.card(achievement, w, h),
    );
    page.add(this.list);

    const refresh = () => this.refresh();
    for (const event of ['AchievementCompleted', 'AchievementClaimed', 'XpGained'] as const) {
      session.bus.on(event, refresh);
    }
    this.drawer.on('drawer-opened', refresh);
    this.show(this.category);
  }

  private show(category: string): void {
    this.category = category;
    this.list.resetPage();
    this.refresh(true);
  }

  private refresh(force = false): void {
    if (!force && !this.drawer.isOpen) return;
    const { progression, achievements } = this.session;
    const [earned, needed] = progression.levelProgress();
    const unclaimed = achievements.unclaimedCount();
    this.levelText.setText(
      `Level ${progression.level()} · ${needed ? `${earned}/${needed} xp` : 'max level'}` +
        (unclaimed ? ` · ${unclaimed} to claim!` : ''),
    );
    this.xpBar.setProgress(needed ? earned / needed : 1);
    this.chips.forEach((chip, id) => chip.setSelected(id === this.category));
    this.list.setItems(achievements.all().filter((a) => a.category === this.category));
  }

  private card(
    achievement: AchievementDef,
    width: number,
    height: number,
  ): Phaser.GameObjects.GameObject[] {
    const { scene, session } = this;
    const { achievements } = session;
    const status = achievements.status(achievement);
    const target = achievements.target(achievement);
    const value = Math.min(target, Math.floor(achievements.value(achievement.stat)));
    const done = status === 'completed' || status === 'claimed';
    const objects: Phaser.GameObjects.GameObject[] = [
      createFrame(scene, 0, 0, width, height, status === 'completed' ? 'slotSelected' : 'slot'),
    ];
    const icon = iconImage(
      scene,
      iconKey(done ? 'achievements' : 'lock'),
      PAD + ICON / 2,
      height / 2,
      ICON,
    );
    if (status === 'locked') icon.setAlpha(0.6);
    objects.push(icon);
    const left = PAD * 2 + ICON;
    const textWidth = width - left - CLAIM_WIDTH - PAD * 2;
    objects.push(
      fitText(scene.add.text(left, PAD, achievement.name, uiText(FONT_SIZE.body)), textWidth),
    );
    objects.push(
      fitText(
        scene.add.text(
          left,
          PAD + UI_PX * 9,
          achievement.description,
          uiText(FONT_SIZE.small, UI_TEXT.muted),
        ),
        textWidth,
      ),
    );
    const barY = height - PAD - UI_PX * 7;
    const bar = new ProgressBar(
      scene,
      left,
      barY,
      Math.floor(textWidth * 0.45),
      UI_PX * 4,
      BAR_COLORS.xp,
    );
    bar.setProgress(done ? 1 : value / target);
    objects.push(bar);
    const progress = done ? 'Done' : `${value}/${target}`;
    objects.push(
      fitText(
        scene.add
          .text(
            left + Math.floor(textWidth * 0.45) + UI_PX * 2,
            barY + UI_PX * 2,
            `${progress} · ${describeReward(session, achievement.reward)}`,
            uiText(FONT_SIZE.small, UI_TEXT.good),
          )
          .setOrigin(0, 0.5),
        textWidth - Math.floor(textWidth * 0.45) - UI_PX * 2,
      ),
    );
    const claim = new Button(scene, width - CLAIM_WIDTH - PAD, (height - UI_PX * 14) / 2, {
      width: CLAIM_WIDTH,
      height: UI_PX * 14,
      label: status === 'claimed' ? 'Claimed' : 'Claim',
      fontSize: FONT_SIZE.small,
      align: 'center',
      onClick: () => this.claim(achievement),
    }).setEnabled(status === 'completed');
    objects.push(claim);
    return objects;
  }

  private claim(achievement: AchievementDef): void {
    const result = this.session.achievements.claim(achievement.id);
    this.toasts.show(
      result.ok
        ? `${achievement.name}: ${describeReward(this.session, achievement.reward)}`
        : result.reason,
      { icon: iconKey('achievements'), color: result.ok ? UI_TEXT.gold : UI_TEXT.danger },
    );
  }
}
