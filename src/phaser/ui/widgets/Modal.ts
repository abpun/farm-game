import * as Phaser from 'phaser';
import { playCue } from '../../audio/playCue';
import { reducedMotion } from '../../fx/prefs';
import { GAME_HEIGHT, GAME_WIDTH } from '../../layout';
import { FONT_SIZE, UI_COLORS, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button, type ButtonSkin } from './Button';
import { Panel } from './Panel';

export interface ModalAction {
  label: string;
  icon?: string;
  skin?: ButtonSkin;
  /** Click cue; defaults to the confirmation sound. */
  sound?: string | null;
  /** Return false to keep the modal open. */
  onClick: () => void | boolean | Promise<void>;
}

export interface ModalOptions {
  title: string;
  message?: string;
  width?: number;
  actions: ModalAction[];
}

const DEFAULT_WIDTH = UI_PX * 140;
const ACTION_HEIGHT = UI_PX * 18;
const ACTION_GAP = UI_PX * 3;
const MODAL_DEPTH = 1000;
const BACKDROP_ALPHA = 0.55;
const FADE_MS = 120;
const POP_SCALE = 0.96;

export class Modal extends Phaser.GameObjects.Container {
  static open(scene: Phaser.Scene, options: ModalOptions): Modal {
    return new Modal(scene, options);
  }

  private constructor(scene: Phaser.Scene, options: ModalOptions) {
    super(scene, 0, 0);
    const width = options.width ?? DEFAULT_WIDTH;
    const backdrop = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, UI_COLORS.backdrop, BACKDROP_ALPHA)
      .setOrigin(0)
      .setInteractive();
    backdrop.on('pointerup', () => this.close());
    this.add(backdrop);

    const message = options.message
      ? scene.add.text(0, 0, options.message, {
          ...uiText(FONT_SIZE.body, UI_TEXT.dark),
          wordWrap: { width: width - UI_PX * 16 },
          lineSpacing: UI_PX,
        })
      : null;
    const messageHeight = message ? message.height + UI_PX * 6 : 0;
    const actionsHeight = options.actions.length * (ACTION_HEIGHT + ACTION_GAP);
    const height = UI_PX * 24 + messageHeight + actionsHeight;
    const x = Math.round((GAME_WIDTH - width) / 2 / UI_PX) * UI_PX;
    const y = Math.round((GAME_HEIGHT - height) / 2 / UI_PX) * UI_PX;

    const panel = new Panel(scene, x, y, width, height, {
      title: options.title,
      onClose: () => this.close(),
    });
    this.add(panel);
    if (message) panel.content.add(message.setPosition(UI_PX * 2, UI_PX * 2));

    options.actions.forEach((action, index) => {
      const button = new Button(scene, 0, messageHeight + index * (ACTION_HEIGHT + ACTION_GAP), {
        width: panel.innerWidth,
        height: ACTION_HEIGHT,
        label: action.label,
        icon: action.icon,
        iconSize: UI_PX * 9,
        skin: action.skin ?? 'wood',
        align: 'center',
        sound: action.sound === undefined ? 'confirm' : action.sound,
        onClick: async () => {
          const keepOpen = (await action.onClick()) === false;
          if (!keepOpen) this.close(true);
        },
      });
      panel.content.add(button);
    });

    this.setDepth(MODAL_DEPTH).setAlpha(0);
    scene.add.existing(this);
    playCue(scene, 'open');
    scene.tweens.add({ targets: this, alpha: 1, duration: FADE_MS });
    if (!reducedMotion(scene)) popIn(scene, panel);
  }

  /** `silent` when an action button already gave its own feedback. */
  close(silent = false): void {
    if (!this.active) return;
    this.setActive(false);
    if (!silent) playCue(this.scene, 'close');
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => this.destroy(),
    });
  }
}

// A short grow from just under full size, around the panel's centre.
export function popIn(scene: Phaser.Scene, panel: Panel): void {
  const { x, y, panelWidth, panelHeight } = panel;
  const offset = (1 - POP_SCALE) / 2;
  panel.setScale(POP_SCALE).setPosition(x + panelWidth * offset, y + panelHeight * offset);
  scene.tweens.add({ targets: panel, scale: 1, x, y, duration: FADE_MS, ease: 'Back.easeOut' });
}
