import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { GAME_WIDTH, HUD } from '../../layout';
import { iconKey, seasonIconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, uiTextOnWood } from '../uiTheme';
import { Button } from '../widgets/Button';
import { CoinCounter } from '../widgets/CoinCounter';
import { createFrame } from '../widgets/Frame';

const SAVE_BLINK_MS = 900;

export class Hud {
  private readonly coins: CoinCounter;
  private readonly dayText: Phaser.GameObjects.Text;
  private readonly seasonIcon: Phaser.GameObjects.Image;
  private readonly saveIcon: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    onMenu: () => void,
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

    this.saveIcon = scene.add
      .image(dayX + dayWidth + margin, margin + height / 2, iconKey('save'))
      .setOrigin(0, 0.5)
      .setScale(UI_PX)
      .setAlpha(0);

    new Button(scene, GAME_WIDTH - margin - height, margin, {
      width: height,
      height,
      icon: iconKey('menu'),
      iconSize: UI_PX * 11,
      align: 'center',
      onClick: onMenu,
    });

    session.bus.on('MoneyChanged', ({ balance }) => this.coins.setValue(balance));
    session.bus.on('GameSaved', () => this.blinkSaved());
  }

  private readonly iconSize: number;

  update(): void {
    const { seasons } = this.session;
    const season = seasons.current();
    this.dayText.setText(`${season.name} ${seasons.dayOfSeason()}`);
    const icon = seasonIconKey(season.id);
    if (this.seasonIcon.texture.key === icon) return;
    this.seasonIcon.setTexture(icon);
    this.seasonIcon.setScale(Math.floor(this.iconSize / this.seasonIcon.height));
  }

  private blinkSaved(): void {
    this.scene.tweens.add({
      targets: this.saveIcon,
      alpha: { from: 1, to: 0 },
      duration: SAVE_BLINK_MS,
    });
  }
}
