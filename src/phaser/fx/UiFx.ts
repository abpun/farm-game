import * as Phaser from 'phaser';
import { BARN_FULL } from '@core/FarmService';
import type { GameSession } from '@core/GameSession';
import { DOCK, GAME_WIDTH, PIXEL_SCALE } from '../layout';
import { getUiBus } from '../session';
import { formatMoney } from '../ui/format';
import { itemIconKey } from '../ui/itemIcons';
import type { Docks } from '../ui/screens/Docks';
import type { Hud } from '../ui/screens/Hud';
import { iconKey } from '../ui/uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiTextOnWood } from '../ui/uiTheme';
import { createFrame } from '../ui/widgets/Frame';
import { ParticlePool } from './ParticlePool';
import { effectsEnabled, reducedMotion, shakeEnabled } from './prefs';
import { UI_FX } from './uiFxPalette';

const FX_DEPTH = 1200;
const MAX_PARTICLES = 90;
const MAX_FLYERS = 6;
const MERGE_MS = 250;
const NOT_ENOUGH_MONEY = 'Not enough money';

interface Tally {
  amount: number;
  timer: Phaser.Time.TimerEvent | null;
}

// HUD-level reward feedback: numbers that float off the counters, items that fly into
// the barn, a level-up banner, and a nudge on whatever blocked an action.
export class UiFx {
  private readonly particles: ParticlePool;
  private readonly earned: Tally = { amount: 0, timer: null };
  private readonly spent: Tally = { amount: 0, timer: null };
  private readonly xp: Tally = { amount: 0, timer: null };
  private flyers = 0;
  private banner: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly hud: Hud,
    private readonly docks: Docks,
  ) {
    this.particles = new ParticlePool(scene, MAX_PARTICLES, UI_PX, FX_DEPTH);
    const { bus } = session;
    const offs = [
      bus.on('MoneyChanged', ({ delta }) =>
        this.tally(delta > 0 ? this.earned : this.spent, delta, (n) => this.showMoney(n)),
      ),
      bus.on('XpGained', ({ amount }) => this.tally(this.xp, amount, (n) => this.showXp(n))),
      bus.on('LevelUp', ({ level }) => this.levelUp(level)),
      bus.on('AchievementCompleted', () => this.celebrateDock('achievements')),
      bus.on('OrderCompleted', () => this.celebrateDock('orders')),
      bus.on('DayChanged', () => this.hud.markNewDay()),
    ];
    const uiBus = getUiBus(scene);
    const offCollected = uiBus.on('Collected', ({ x, y, itemId }) => this.flyToBarn(x, y, itemId));
    const offDenied = uiBus.on('Denied', ({ reason }) => this.pointAt(reason));
    scene.events.once('shutdown', () => {
      [...offs, offCollected, offDenied].forEach((off) => off());
    });
  }

  private get on(): boolean {
    return effectsEnabled(this.scene) && !reducedMotion(this.scene);
  }

  // Bursts like "sell everything" arrive as many events; show them as one number.
  private tally(tally: Tally, amount: number, show: (total: number) => void): void {
    if (amount === 0) return;
    tally.amount += amount;
    if (tally.timer) return;
    tally.timer = this.scene.time.delayedCall(MERGE_MS, () => {
      show(tally.amount);
      tally.amount = 0;
      tally.timer = null;
    });
  }

  private showMoney(total: number): void {
    const { x, y } = this.hud.coinAnchor;
    const gain = total > 0;
    this.float(
      x,
      y,
      `${gain ? '+' : '-'}$${formatMoney(Math.abs(total))}`,
      gain ? UI_TEXT.gold : UI_TEXT.light,
    );
    if (gain && this.on) this.particles.burst(x - HUD_COIN_OFFSET, y - UI_PX * 9, UI_FX.coins);
  }

  // Beside the level plaque rather than under it, where toasts appear.
  private showXp(total: number): void {
    const { x, y } = this.hud.xpAnchor;
    this.float(x, y, `+${total} xp`, UI_TEXT.gold, 0, -UI_FX.floatDistance);
  }

  /** A short label by a HUD plaque that drifts and fades (only fades with reduced motion). */
  private float(
    x: number,
    y: number,
    message: string,
    color: string,
    originX = 0.5,
    drift: number = UI_FX.floatDistance,
  ): void {
    if (!effectsEnabled(this.scene)) return;
    const text = this.scene.add
      .text(x, y, message, uiTextOnWood(FONT_SIZE.body, color))
      .setOrigin(originX, drift > 0 ? 0 : 0.5)
      .setDepth(FX_DEPTH);
    this.scene.tweens.add({
      targets: text,
      y: reducedMotion(this.scene) ? text.y : text.y + drift,
      alpha: { from: 1, to: 0 },
      delay: UI_FX.floatHoldMs,
      duration: UI_FX.floatMs,
      ease: 'Quad.easeIn',
      onComplete: () => text.destroy(),
    });
  }

  private flyToBarn(x: number, y: number, itemId: string): void {
    const barn = this.docks.buttons.get('barn');
    if (!barn || !this.on || this.flyers >= MAX_FLYERS) return;
    const key = itemIconKey(this.session.content, itemId);
    const icon = this.scene.add.image(x, y, key).setDepth(FX_DEPTH).setScale(PIXEL_SCALE);
    const target = { x: barn.x + DOCK.button / 2, y: barn.y + DOCK.button / 2 };
    const path = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x, y),
      new Phaser.Math.Vector2((x + target.x) / 2, Math.min(y, target.y) - UI_FX.arcHeight),
      new Phaser.Math.Vector2(target.x, target.y),
    );
    const state = { t: 0 };
    this.flyers += 1;
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: UI_FX.flyMs,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const point = path.getPoint(state.t);
        icon.setPosition(Math.round(point.x), Math.round(point.y));
        icon.setScale(PIXEL_SCALE * (1 - state.t * UI_FX.flyShrink));
      },
      onComplete: () => {
        icon.destroy();
        this.flyers -= 1;
        this.hop('barn');
      },
    });
  }

  private levelUp(level: number): void {
    this.banner?.destroy();
    const label = this.scene.add
      .text(0, 0, `Level ${level}!`, uiTextOnWood(FONT_SIZE.big, UI_TEXT.gold))
      .setOrigin(0.5);
    const star = iconKey('star');
    const width = Math.ceil((label.width + UI_PX * 40) / UI_PX) * UI_PX;
    const height = UI_PX * 22;
    const frame = createFrame(this.scene, -width / 2, -height / 2, width, height, 'plaque');
    const left = this.scene.add.image(-width / 2 + UI_PX * 10, 0, star).setScale(UI_PX);
    const right = this.scene.add.image(width / 2 - UI_PX * 10, 0, star).setScale(UI_PX);
    const banner = this.scene.add
      .container(GAME_WIDTH / 2, UI_FX.bannerY, [frame, label, left, right])
      .setDepth(FX_DEPTH)
      .setAlpha(0);
    this.banner = banner;
    const still = reducedMotion(this.scene);
    if (!still) banner.setScale(UI_FX.bannerPop);
    this.scene.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: UI_FX.bannerInMs,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: banner,
      alpha: 0,
      delay: UI_FX.bannerHoldMs,
      duration: UI_FX.bannerOutMs,
      onComplete: () => {
        banner.destroy();
        if (this.banner === banner) this.banner = null;
      },
    });
    if (this.on) {
      this.particles.burst(GAME_WIDTH / 2, UI_FX.bannerY, UI_FX.stars);
      const { x, y } = this.hud.levelAnchor;
      this.particles.burst(x, y - UI_PX * 9, UI_FX.stars);
    }
    if (shakeEnabled(this.scene)) {
      this.scene.scene.get('Farm').cameras.main.shake(UI_FX.shake.ms, UI_FX.shake.intensity);
    }
  }

  private celebrateDock(id: string): void {
    const button = this.docks.buttons.get(id);
    if (!button) return;
    this.hop(id);
    if (this.on) {
      const x = button.x + DOCK.button / 2;
      this.particles.burst(x, button.y + DOCK.button / 2, UI_FX.sparkle);
    }
  }

  /** A quick upward hop, so the eye finds where something just went. */
  private hop(id: string): void {
    const button = this.docks.buttons.get(id);
    if (!button || reducedMotion(this.scene) || this.scene.tweens.isTweening(button)) return;
    const y = button.y;
    this.scene.tweens.add({
      targets: button,
      y: y - UI_FX.hop,
      duration: UI_FX.hopMs,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => button.setY(y),
    });
  }

  // Points at the cause of a refusal: the barn when it is full, the purse when coins are short.
  private pointAt(reason: string): void {
    if (reason.includes(BARN_FULL)) this.nudge(this.docks.buttons.get('barn'));
    else if (reason.includes(NOT_ENOUGH_MONEY)) this.nudge(this.hud.coinCounter);
  }

  private nudge(target: Phaser.GameObjects.Container | undefined): void {
    if (!target || this.scene.tweens.isTweening(target)) return;
    if (reducedMotion(this.scene)) {
      target.setAlpha(UI_FX.dimAlpha);
      this.scene.time.delayedCall(UI_FX.hopMs * 3, () => target.setAlpha(1));
      return;
    }
    const x = target.x;
    this.scene.tweens.add({
      targets: target,
      x: x + UI_FX.nudge,
      duration: UI_FX.nudgeMs,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => target.setX(x),
    });
  }
}

const HUD_COIN_OFFSET = UI_PX * 22;
