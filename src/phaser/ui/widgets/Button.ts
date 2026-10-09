import * as Phaser from 'phaser';
import type { FrameName } from '../uiTextures';
import { playCue } from '../../audio/playCue';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText, uiTextOnWood } from '../uiTheme';
import { createFrame, setFrame } from './Frame';

export type ButtonSkin = 'wood' | 'slot' | 'tab';

const SKINS: Record<
  ButtonSkin,
  Record<'normal' | 'hover' | 'pressed' | 'selected' | 'disabled', FrameName>
> = {
  wood: {
    normal: 'woodButton',
    hover: 'woodButtonHover',
    pressed: 'woodButtonPressed',
    selected: 'woodButtonSelected',
    disabled: 'woodButtonDisabled',
  },
  slot: {
    normal: 'slot',
    hover: 'slotHover',
    pressed: 'slotPressed',
    selected: 'slotSelected',
    disabled: 'slotDisabled',
  },
  tab: {
    normal: 'tab',
    hover: 'tab',
    pressed: 'tabActive',
    selected: 'tabActive',
    disabled: 'tab',
  },
};

export interface ButtonOptions {
  width: number;
  height: number;
  label?: string;
  sublabel?: string;
  icon?: string;
  iconSize?: number;
  skin?: ButtonSkin;
  align?: 'left' | 'center';
  fontSize?: number;
  /** Cue played on click; null when the action makes its own sound (opening a drawer). */
  sound?: string | null;
  onClick: () => void;
}

interface ButtonFlags {
  enabled: boolean;
  selected: boolean;
  hovered: boolean;
  pressed: boolean;
}

const PADDING = UI_PX * 4;
const GAP = UI_PX * 2;

export class Button extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.NineSlice;
  private readonly content: Phaser.GameObjects.Container;
  private readonly label?: Phaser.GameObjects.Text;
  private readonly icon?: Phaser.GameObjects.Image;
  private readonly sublabel?: Phaser.GameObjects.Text;
  private readonly skin: ButtonSkin;
  private readonly centered: boolean;
  private readonly buttonWidth: number;
  private flags: ButtonFlags = { enabled: true, selected: false, hovered: false, pressed: false };
  private readonly options: ButtonOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ButtonOptions) {
    super(scene, x, y);
    this.skin = options.skin ?? 'wood';
    this.background = createFrame(
      scene,
      0,
      0,
      options.width,
      options.height,
      SKINS[this.skin].normal,
    );
    this.content = scene.add.container(0, 0);
    this.add([this.background, this.content]);

    let cursor = PADDING;
    if (options.icon) {
      const icon = scene.add.image(cursor, options.height / 2, options.icon).setOrigin(0, 0.5);
      this.icon = icon;
      icon.setScale(
        Math.max(1, Math.floor((options.iconSize ?? options.height * 0.6) / icon.height)),
      );
      this.content.add(icon);
      cursor += icon.displayWidth + GAP;
    }
    const style = this.skin === 'slot' ? uiText : uiTextOnWood;
    const size = options.fontSize ?? FONT_SIZE.body;
    if (options.label !== undefined) {
      const labelY = options.sublabel ? options.height / 2 - size * 0.45 : options.height / 2;
      this.label = scene.add.text(cursor, labelY, options.label, style(size)).setOrigin(0, 0.5);
      this.content.add(this.label);
    }
    if (options.sublabel !== undefined) {
      const subStyle =
        this.skin === 'slot'
          ? uiText(FONT_SIZE.small, UI_TEXT.muted)
          : uiTextOnWood(FONT_SIZE.small);
      this.sublabel = scene.add
        .text(cursor, options.height / 2 + size * 0.5, options.sublabel, subStyle)
        .setOrigin(0, 0.5);
      this.content.add(this.sublabel);
    }
    this.buttonWidth = options.width;
    this.centered = (options.align ?? (options.icon ? 'left' : 'center')) === 'center';
    if (this.centered) this.centerContent(options.width);

    this.background
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.setFlags({ hovered: true }))
      .on('pointerout', () => this.setFlags({ hovered: false, pressed: false }))
      .on('pointerdown', () => this.setFlags({ pressed: true }))
      .on('pointerup', () => {
        const { pressed } = this.flags;
        this.setFlags({ pressed: false });
        if (pressed) this.press();
      });
    this.options = options;
    scene.add.existing(this);
  }

  /** Clicks the button (pointer or keyboard): sound plus action, or the refusal cue if disabled. */
  press(): void {
    if (!this.flags.enabled) {
      playCue(this.scene, 'error');
      return;
    }
    const { sound, onClick } = this.options;
    const cue = sound === undefined ? this.defaultSound() : sound;
    if (cue) playCue(this.scene, cue);
    onClick();
  }

  private defaultSound(): string {
    return this.skin === 'tab' ? 'tab' : 'click';
  }

  setLabel(text: string): this {
    if (!this.label || this.label.text === text) return this;
    this.label.setText(text);
    if (this.centered) this.centerContent(this.buttonWidth);
    return this;
  }

  /** Swaps the icon for one of the same size (e.g. sound on / muted). */
  setIcon(key: string): this {
    if (this.icon?.texture.key !== key) this.icon?.setTexture(key);
    return this;
  }

  setSublabel(text: string): this {
    this.sublabel?.setText(text);
    return this;
  }

  setSelected(selected: boolean): this {
    return this.setFlags({ selected });
  }

  setEnabled(enabled: boolean): this {
    return this.setFlags({ enabled });
  }

  private setFlags(changes: Partial<ButtonFlags>): this {
    this.flags = { ...this.flags, ...changes };
    const { enabled, pressed, selected, hovered } = this.flags;
    const state = !enabled
      ? 'disabled'
      : pressed
        ? 'pressed'
        : selected
          ? 'selected'
          : hovered
            ? 'hover'
            : 'normal';
    setFrame(this.background, SKINS[this.skin][state]);
    this.content.setY(pressed && enabled ? UI_PX : 0);
    if (this.skin === 'tab') this.restyleTabLabel(selected);
    this.content.setAlpha(enabled ? 1 : 0.6);
    return this;
  }

  // The active tab sits on parchment, so its label switches to dark ink.
  private restyleTabLabel(active: boolean): void {
    this.label?.setColor(active ? UI_TEXT.dark : UI_TEXT.light).setShadowFill(!active);
  }

  private centerContent(width: number): void {
    this.content.setX(0);
    const bounds = this.content.getBounds();
    this.content.setX(Math.round((width - bounds.width) / 2 / UI_PX) * UI_PX - PADDING);
  }
}
