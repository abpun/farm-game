import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../layout';
import { UI_COLORS, UI_PX } from '../uiTheme';
import { Panel } from './Panel';

const DIALOG_DEPTH = 950;
const BACKDROP_ALPHA = 0.45;
const FADE_MS = 120;
const REFRESH_MS = 250;

export interface DialogOptions {
  title: string;
  width: number;
  height: number;
}

const snap = (value: number) => Math.round(value / UI_PX) * UI_PX;

let openDialog: Dialog | null = null;

// A centred panel over a dimmed backdrop for richer screens (buildings, selling, land).
// One at a time; `onRefresh` callbacks re-run on a short timer while it is open.
export class Dialog extends Phaser.GameObjects.Container {
  readonly panel: Panel;
  private readonly refreshers: Array<() => void> = [];
  private readonly cleanups: Array<() => void> = [];
  private readonly timer: Phaser.Time.TimerEvent;

  static open(scene: Phaser.Scene, options: DialogOptions): Dialog {
    openDialog?.close();
    openDialog = new Dialog(scene, options);
    return openDialog;
  }

  static closeAll(): void {
    openDialog?.close();
  }

  private constructor(scene: Phaser.Scene, options: DialogOptions) {
    super(scene, 0, 0);
    const backdrop = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, UI_COLORS.backdrop, BACKDROP_ALPHA)
      .setOrigin(0)
      .setInteractive();
    backdrop.on('pointerup', () => this.close());
    const width = snap(Math.min(options.width, GAME_WIDTH - UI_PX * 8));
    const height = snap(Math.min(options.height, GAME_HEIGHT - UI_PX * 8));
    this.panel = new Panel(
      scene,
      snap((GAME_WIDTH - width) / 2),
      snap((GAME_HEIGHT - height) / 2),
      width,
      height,
      { title: options.title, onClose: () => this.close() },
    );
    this.add([backdrop, this.panel]);
    this.setDepth(DIALOG_DEPTH).setAlpha(0);
    scene.add.existing(this);
    scene.tweens.add({ targets: this, alpha: 1, duration: FADE_MS });
    this.timer = scene.time.addEvent({
      delay: REFRESH_MS,
      loop: true,
      callback: () => this.refresh(),
    });
  }

  get content(): Phaser.GameObjects.Container {
    return this.panel.content;
  }

  get innerWidth(): number {
    return this.panel.innerWidth;
  }

  get innerHeight(): number {
    return this.panel.innerHeight;
  }

  /** Runs now and then on every refresh tick while the dialog is open. */
  onRefresh(callback: () => void): this {
    this.refreshers.push(callback);
    callback();
    return this;
  }

  /** Registers a cleanup (e.g. a bus unsubscribe) for when the dialog closes. */
  onClose(cleanup: () => void): this {
    this.cleanups.push(cleanup);
    return this;
  }

  refresh(): void {
    if (this.active) this.refreshers.forEach((callback) => callback());
  }

  close(): void {
    if (!this.active) return;
    if (openDialog === this) openDialog = null;
    this.setActive(false);
    this.timer.remove();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => this.destroy(),
    });
  }
}
