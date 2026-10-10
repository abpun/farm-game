import * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { depositKey, generateMineTextures, MINE_TEXTURES } from '../art/MineArtist';
import { addArt } from '../art/paint';
import { WILD_TEXTURES } from '../art/WildArtist';
import { playCue } from '../audio/playCue';
import { floatText } from '../components/floatingText';
import { ParticlePool } from '../fx/ParticlePool';
import { effectsEnabled, reducedMotion } from '../fx/prefs';
import { GAME_WIDTH, PIXEL_SCALE } from '../layout';
import { getSession, getUiBus } from '../session';
import { TEXT } from '../theme';
import { formatDuration, formatMoney } from '../ui/format';
import { iconKey } from '../ui/uiTextures';
import { FONT_SIZE, UI_PX, uiTextOnWood } from '../ui/uiTheme';
import { Button } from '../ui/widgets/Button';
import { createFrame } from '../ui/widgets/Frame';
import { describeQuantities } from '@core/services/rewards';

const FLOOR_TOP = 150;
const HALF_TILE = { x: 60, y: 30 };
const REFRESH_MS = 250;
const FADE_MS = 300;
const SWING = { from: -70, to: 25, ms: 110 };
const CHIPS = {
  count: 8,
  speed: [60, 140] as [number, number],
  life: [250, 450] as [number, number],
};
const PIP = UI_PX * 2;
const BAR = { width: UI_PX * 270, height: UI_PX * 22, y: 720 - UI_PX * 26 };
const CACHE = { col: 0.5, row: 0.35, id: 'mine-cache' };
const GLOWS: Array<[number, number]> = [
  [140, 130],
  [400, 110],
  [880, 110],
  [1140, 130],
];

interface NodeView {
  id: string;
  image: Phaser.GameObjects.Image;
  pips: Phaser.GameObjects.Graphics;
  lock: Phaser.GameObjects.Image;
  at: { x: number; y: number };
}

// Down the mine: one room of deposits. Strikes and drops are core actions, so
// leaving, reloading or tapping fast can never pay a deposit twice.
export class MineScene extends Phaser.Scene {
  private nodes: NodeView[] = [];
  private particles!: ParticlePool;
  private pickaxe!: Phaser.GameObjects.Image;
  private toolText!: Phaser.GameObjects.Text;
  private upgrade!: Button;
  private satchel!: Phaser.GameObjects.Image;

  constructor() {
    super('Mine');
  }

  create(): void {
    const session = getSession(this);
    generateMineTextures(
      this,
      session.content.deposits.all().map((d) => d.id),
    );
    this.nodes = [];
    addArt(this, 0, 0, MINE_TEXTURES.backdrop);
    const floor = addArt(this, 0, FLOOR_TOP, MINE_TEXTURES.floor);
    floor.setX(Math.round((GAME_WIDTH - floor.displayWidth) / 2));
    for (const [x, y] of GLOWS) this.lantern(x, y);
    const exit = this.add.zone(123, 444, 100, 140).setInteractive({ useHandCursor: true });
    exit.on('pointerup', () => this.leave());

    for (const node of session.mining.nodes()) this.nodes.push(this.nodeView(session, node.id));
    this.satchel = this.placeCache(session);
    this.particles = new ParticlePool(this, 60, PIXEL_SCALE, 5000);
    this.pickaxe = addArt(this, 0, 0, MINE_TEXTURES.pickaxe, 0.2, 0.9)
      .setVisible(false)
      .setDepth(6000);
    this.toolBar(session);
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh(session) });
    this.refresh(session);
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
  }

  private leave(): void {
    getUiBus(this).emit('LeaveMine', {});
  }

  private screenOf(col: number, row: number) {
    return {
      x: GAME_WIDTH / 2 + (col - row) * HALF_TILE.x,
      y: FLOOR_TOP + (col + row) * HALF_TILE.y,
    };
  }

  private nodeView(session: GameSession, nodeId: string): NodeView {
    const node = session.content.mineNodes.get(nodeId);
    const at = this.screenOf(node.col, node.row);
    const image = addArt(this, at.x, at.y, depositKey(node.deposit), 0.5, 0.85)
      .setDepth(at.y)
      .setInteractive({ useHandCursor: true });
    image.on('pointerup', () => this.strike(session, nodeId));
    const pips = this.add.graphics().setDepth(at.y + 1);
    const lock = this.add
      .image(at.x + UI_PX * 9, at.y - UI_PX * 18, iconKey('lock'))
      .setScale(2)
      .setDepth(at.y + 2);
    return { id: nodeId, image, pips, lock, at };
  }

  private strike(session: GameSession, nodeId: string): void {
    const view = this.nodes.find((n) => n.id === nodeId);
    if (!view) return;
    const result = session.mining.strike(nodeId);
    if (!result.ok) {
      const regrowing = session.mining.status(nodeId) === 'regrowing';
      const message = regrowing
        ? `Grows back in ${formatDuration(session.mining.regrowRemaining(nodeId))}`
        : result.reason;
      floatText(this, view.at.x, view.at.y - 50, message, regrowing ? TEXT.muted : TEXT.error);
      if (!regrowing) {
        playCue(this, 'error');
        getUiBus(this).emit('Denied', { reason: result.reason });
      }
      return;
    }
    this.swing(view);
    this.chips(view, result.broken);
    if (!result.broken) return;
    floatText(
      this,
      view.at.x,
      view.at.y - 56,
      `+${describeQuantities(session, result.items)}`,
      TEXT.success,
    );
    const [itemId] = Object.keys(result.items);
    if (itemId) getUiBus(this).emit('Collected', { x: view.at.x, y: view.at.y - 30, itemId });
    this.refresh(session);
  }

  private swing(view: NodeView): void {
    if (reducedMotion(this)) return;
    this.pickaxe
      .setPosition(view.at.x + 30, view.at.y - 54)
      .setAngle(SWING.from)
      .setVisible(true);
    this.tweens.add({
      targets: this.pickaxe,
      angle: SWING.to,
      duration: SWING.ms,
      ease: 'Quad.easeIn',
      onComplete: () => this.pickaxe.setVisible(false),
    });
    if (!view.image.active) return;
    this.tweens.add({
      targets: view.image,
      x: view.at.x + PIXEL_SCALE,
      duration: 40,
      yoyo: true,
      repeat: 1,
    });
  }

  private chips(view: NodeView, broken: boolean): void {
    if (!effectsEnabled(this) || reducedMotion(this)) return;
    this.particles.burst(view.at.x, view.at.y - 30, {
      count: broken ? CHIPS.count * 2 : CHIPS.count,
      colors: [0x76716a, 0xa8a294, 0x55494a],
      speed: CHIPS.speed,
      angle: [-160, -20],
      gravity: 380,
      life: CHIPS.life,
      spread: 14,
    });
  }

  private placeCache(session: GameSession): Phaser.GameObjects.Image {
    const at = this.screenOf(CACHE.col, CACHE.row);
    const image = addArt(this, at.x, at.y, WILD_TEXTURES.chest, 0.5, 1)
      .setDepth(at.y)
      .setInteractive({ useHandCursor: true });
    image.on('pointerup', () => getUiBus(this).emit('Discover', { id: CACHE.id }));
    const off = session.bus.on('DiscoveryFound', () => this.refresh(session));
    this.events.once('shutdown', off);
    return image;
  }

  private lantern(x: number, y: number): void {
    const glow = addArt(this, x, y, MINE_TEXTURES.glow, 0.5, 0.5).setDepth(10).setAlpha(0.7);
    this.tweens.add({ targets: glow, alpha: 1, duration: 900 + x, yoyo: true, repeat: -1 });
  }

  private toolBar(session: GameSession): void {
    const x = Math.round((GAME_WIDTH - BAR.width) / 2);
    const frame = createFrame(this, x, BAR.y, BAR.width, BAR.height, 'plaque').setDepth(7000);
    this.toolText = this.add
      .text(x + UI_PX * 6, BAR.y + BAR.height / 2, '', uiTextOnWood(FONT_SIZE.body))
      .setOrigin(0, 0.5)
      .setDepth(7001);
    this.upgrade = new Button(this, x + BAR.width - UI_PX * 200, BAR.y + UI_PX * 4, {
      width: UI_PX * 152,
      height: BAR.height - UI_PX * 8,
      label: '',
      fontSize: FONT_SIZE.small,
      align: 'center',
      sound: null,
      onClick: () => this.upgradePickaxe(session),
    }).setDepth(7001);
    new Button(this, x + BAR.width - UI_PX * 46, BAR.y + UI_PX * 4, {
      width: UI_PX * 42,
      height: BAR.height - UI_PX * 8,
      label: 'Leave',
      icon: iconKey('left'),
      iconSize: UI_PX * 7,
      fontSize: FONT_SIZE.small,
      align: 'center',
      sound: 'close',
      onClick: () => this.leave(),
    }).setDepth(7001);
    frame.setInteractive();
  }

  private upgradePickaxe(session: GameSession): void {
    const next = session.mining.nextPickaxe();
    const result = session.mining.upgradePickaxe();
    if (!result.ok) {
      floatText(this, GAME_WIDTH / 2, BAR.y - 20, result.reason, TEXT.error);
      playCue(this, 'error');
      return;
    }
    floatText(this, GAME_WIDTH / 2, BAR.y - 20, `Got the ${next?.name}!`, TEXT.gold);
    this.refresh(session);
  }

  private refresh(session: GameSession): void {
    const { mining } = session;
    for (const view of this.nodes) {
      const deposit = mining.deposit(view.id);
      const ready = mining.status(view.id) === 'ready';
      view.image
        .setTexture(ready ? depositKey(deposit.id) : MINE_TEXTURES.rubble)
        .setAlpha(ready ? 1 : 0.8);
      view.lock.setVisible(ready && deposit.tier > mining.pickaxe().tier);
      this.drawPips(view, ready ? mining.hp(view.id) : 0, deposit.hp);
    }
    this.satchel.setTexture(
      session.exploration.isFound(CACHE.id) ? WILD_TEXTURES.chestOpen : WILD_TEXTURES.chest,
    );
    const pick = mining.pickaxe();
    const next = mining.nextPickaxe();
    this.toolText.setText(`${pick.name}`);
    if (!next) {
      this.upgrade.setLabel('Best pickaxe').setEnabled(false);
      return;
    }
    const materials = Object.keys(next.materials).length
      ? ` + ${describeQuantities(session, next.materials)}`
      : '';
    this.upgrade
      .setLabel(`${next.name} · $${formatMoney(next.price)}${materials}`)
      .setEnabled(true);
  }

  // Pips under a struck deposit show how many strikes are left.
  private drawPips(view: NodeView, hp: number, max: number): void {
    view.pips.clear();
    if (hp <= 0 || hp >= max) return;
    const left = view.at.x - (max * (PIP + UI_PX)) / 2;
    for (let i = 0; i < max; i++) {
      view.pips
        .fillStyle(i < hp ? 0xffd75e : 0x3a2414)
        .fillRect(left + i * (PIP + UI_PX), view.at.y + UI_PX * 2, PIP, PIP);
    }
  }
}
