import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { GAME_WIDTH, HUD } from '../../layout';
import { reducedMotion } from '../../fx/prefs';
import { getSettings } from '../../session';
import { iconKey, seasonIconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiTextOnWood } from '../uiTheme';
import { Button } from '../widgets/Button';
import { CoinCounter } from '../widgets/CoinCounter';
import { createFrame } from '../widgets/Frame';
import { BAR_COLORS, ProgressBar } from '../widgets/ProgressBar';

const SAVE_BLINK_MS = 900;
const XP_BAR_HEIGHT = UI_PX * 4;
const XP_EASE_MS = 400;
const DAY_GLOW_MS = 900;

export class Hud {
  private readonly coins: CoinCounter;
  private readonly dayText: Phaser.GameObjects.Text;
  private readonly seasonIcon: Phaser.GameObjects.Image;
  private readonly saveIcon: Phaser.GameObjects.Image;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly xpBar: ProgressBar;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    onMenu: () => void,
    onPlaces: () => void,
  ) {
    const { margin, height, coinWidth, dayWidth } = HUD;
    this.coins = new CoinCounter(
      scene,
      margin,
      margin,
      coinWidth,
      height,
      session.economy.balance(),
    );

    const dayX = margin * 2 + coinWidth;
    const iconSize = height - UI_PX * 8;
    createFrame(scene, dayX, margin, dayWidth, height, 'plaque');
    this.seasonIcon = scene.add
      .image(dayX + UI_PX * 5 + iconSize / 2, margin + height / 2, iconKey('clock'))
      .setDepth(1);
    this.iconSize = iconSize;
    this.dayText = scene.add
      .text(dayX + UI_PX * 8 + iconSize, margin + height / 2, '', uiTextOnWood(FONT_SIZE.title))
      .setOrigin(0, 0.5)
      .setDepth(1);

    // Level plaque: star, level number and a thin XP bar along the bottom.
    const levelX = dayX + dayWidth + margin;
    const levelWidth = HUD.levelWidth;
    createFrame(scene, levelX, margin, levelWidth, height, 'plaque');
    scene.add
      .image(levelX + UI_PX * 5, margin + height / 2 - UI_PX * 2, iconKey('star'))
      .setOrigin(0, 0.5)
      .setScale(UI_PX)
      .setDepth(1);
    this.levelText = scene.add
      .text(levelX + UI_PX * 15, margin + height / 2 - UI_PX * 2, '', uiTextOnWood(FONT_SIZE.title))
      .setOrigin(0, 0.5)
      .setDepth(1);
    const barWidth = levelWidth - UI_PX * 10;
    this.xpBar = new ProgressBar(
      scene,
      levelX + UI_PX * 5,
      margin + height - UI_PX * 4 - XP_BAR_HEIGHT,
      barWidth,
      XP_BAR_HEIGHT,
      BAR_COLORS.xp,
    ).setDepth(1);

    this.saveIcon = scene.add
      .image(levelX + levelWidth + margin, margin + height / 2, iconKey('save'))
      .setOrigin(0, 0.5)
      .setScale(UI_PX)
      .setAlpha(0);

    new Button(scene, GAME_WIDTH - margin - height, margin, {
      width: height,
      height,
      icon: iconKey('menu'),
      iconSize: UI_PX * 11,
      align: 'center',
      sound: null,
      onClick: onMenu,
    });
    this.addMuteButton(GAME_WIDTH - margin * 2 - height * 2);
    new Button(scene, GAME_WIDTH - margin * 3 - height * 3, margin, {
      width: height,
      height,
      icon: iconKey('compass'),
      iconSize: UI_PX * 11,
      align: 'center',
      sound: null,
      onClick: onPlaces,
    });

    session.bus.on('MoneyChanged', ({ balance }) => this.coins.setValue(balance));
    session.bus.on('GameSaved', () => this.blinkSaved());
  }

  private readonly iconSize: number;

  update(): void {
    const { seasons, progression } = this.session;
    const [earned, needed] = progression.levelProgress();
    this.levelText.setText(`Lv ${progression.level()}`);
    this.xpBar.easeTo(needed ? earned / needed : 1, reducedMotion(this.scene) ? 0 : XP_EASE_MS);
    const season = seasons.current();
    this.dayText.setText(`${season.name} ${seasons.dayOfSeason()}`);
    const icon = seasonIconKey(season.id);
    if (this.seasonIcon.texture.key === icon) return;
    this.seasonIcon.setTexture(icon);
    this.seasonIcon.setScale(Math.floor(this.iconSize / this.seasonIcon.height));
  }

  // Quick master mute beside the menu; it mirrors the setting, wherever that changes.
  private addMuteButton(x: number): void {
    const settings = getSettings(this.scene);
    const { margin, height } = HUD;
    const button = new Button(this.scene, x, margin, {
      width: height,
      height,
      icon: iconKey('sound'),
      iconSize: UI_PX * 11,
      align: 'center',
      sound: 'toggle',
      onClick: () => settings.setMuted('master', !settings.get().muted.master),
    });
    const sync = () => button.setIcon(iconKey(settings.get().muted.master ? 'mute' : 'sound'));
    sync();
    const off = settings.onChange(sync);
    this.scene.events.once('shutdown', off);
  }

  /** Screen points where reward numbers float from. */
  get coinAnchor(): { x: number; y: number } {
    return { x: HUD.margin + HUD.coinWidth / 2, y: HUD.margin + HUD.height + UI_PX * 2 };
  }

  /** Right of the level plaque and the save icon, vertically centred on the HUD row. */
  get xpAnchor(): { x: number; y: number } {
    const x = HUD.margin * 4 + HUD.coinWidth + HUD.dayWidth + HUD.levelWidth + UI_PX * 12;
    return { x, y: HUD.margin + HUD.height / 2 };
  }

  get levelAnchor(): { x: number; y: number } {
    const x = HUD.margin * 3 + HUD.coinWidth + HUD.dayWidth + HUD.levelWidth / 2;
    return { x, y: HUD.margin + HUD.height };
  }

  get coinCounter(): CoinCounter {
    return this.coins;
  }

  /** A soft gold glow on the date when a new day starts (colour only, no motion). */
  markNewDay(): void {
    this.dayText.setColor(UI_TEXT.gold);
    this.scene.time.delayedCall(DAY_GLOW_MS, () => this.dayText.setColor(UI_TEXT.light));
  }

  private blinkSaved(): void {
    this.scene.tweens.add({
      targets: this.saveIcon,
      alpha: { from: 1, to: 0 },
      duration: SAVE_BLINK_MS,
    });
  }
}
