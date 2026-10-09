import * as Phaser from 'phaser';
import { playCue } from '../../audio/playCue';
import { UI_COLORS, UI_PX } from '../uiTheme';
import { createFrame, setFrame } from './Frame';

const KNOB_WIDTH = UI_PX * 6;
const TRACK_HEIGHT = UI_PX * 4;
const FILL_COLOR = 0xf6c544;

export interface SliderOptions {
  width: number;
  height: number;
  value: number;
  /** Values snap to this step (0.05 = 5%). */
  step: number;
  onChange: (value: number) => void;
}

// Horizontal 0..1 slider: a recessed track with a gold fill and a wooden knob.
// Click or drag anywhere on it; `nudge` moves one step for keyboard control.
export class Slider extends Phaser.GameObjects.Container {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly knob: Phaser.GameObjects.NineSlice;
  private readonly trackWidth: number;
  private value: number;
  private dragging = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly options: SliderOptions,
  ) {
    super(scene, x, y);
    const { width, height } = options;
    this.trackWidth = width - KNOB_WIDTH;
    const trackY = (height - TRACK_HEIGHT) / 2;
    const outline = scene.add
      .rectangle(KNOB_WIDTH / 2, trackY, this.trackWidth, TRACK_HEIGHT, UI_COLORS.outline)
      .setOrigin(0);
    const track = scene.add
      .rectangle(
        KNOB_WIDTH / 2 + UI_PX,
        trackY + UI_PX,
        this.trackWidth - UI_PX * 2,
        TRACK_HEIGHT - UI_PX * 2,
        UI_COLORS.woodDeep,
      )
      .setOrigin(0);
    this.fill = scene.add
      .rectangle(KNOB_WIDTH / 2 + UI_PX, trackY + UI_PX, 0, TRACK_HEIGHT - UI_PX * 2, FILL_COLOR)
      .setOrigin(0);
    this.knob = createFrame(scene, 0, 0, KNOB_WIDTH, height, 'woodButton');
    const hit = scene.add
      .zone(0, 0, width, height)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.add([outline, track, this.fill, this.knob, hit]);

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.fromPointer(pointer);
    });
    hit.on('pointerover', () => this.setKnob('woodButtonHover'));
    hit.on('pointerout', () => !this.dragging && this.setKnob('woodButton'));
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
    });

    this.value = this.snap(options.value);
    this.draw();
    scene.add.existing(this);
  }

  get current(): number {
    return this.value;
  }

  /** Shows a value without reporting it (e.g. after settings were reset elsewhere). */
  setValue(value: number): this {
    this.value = this.snap(value);
    return this.draw();
  }

  nudge(steps: number): void {
    this.commit(this.value + steps * this.options.step);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragging && pointer.isDown) this.fromPointer(pointer);
  }

  private onUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.setKnob('woodButton');
  }

  private fromPointer(pointer: Phaser.Input.Pointer): void {
    const left = this.getBounds().x + KNOB_WIDTH / 2;
    this.setKnob('woodButtonPressed');
    this.commit((pointer.x - left) / this.trackWidth);
  }

  private commit(raw: number): void {
    const next = this.snap(raw);
    if (next === this.value) return;
    this.value = next;
    this.draw();
    playCue(this.scene, 'tick');
    this.options.onChange(next);
  }

  private snap(raw: number): number {
    const steps = Math.round(Math.min(1, Math.max(0, raw)) / this.options.step);
    return Math.min(1, Number((steps * this.options.step).toFixed(4)));
  }

  private draw(): this {
    const span = this.trackWidth - UI_PX * 2;
    this.fill.width = Math.round((span * this.value) / UI_PX) * UI_PX;
    this.fill.setVisible(this.value > 0);
    this.knob.setX(Math.round((this.trackWidth * this.value) / UI_PX) * UI_PX);
    return this;
  }

  private setKnob(frame: 'woodButton' | 'woodButtonHover' | 'woodButtonPressed'): void {
    setFrame(this.knob, frame);
  }
}
