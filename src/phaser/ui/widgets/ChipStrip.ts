import type * as Phaser from 'phaser';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, uiTextOnWood } from '../uiTheme';
import { Button } from './Button';
import { createFrame } from './Frame';

export interface ChipSpec {
  id: string;
  icon?: string;
  label?: string;
}

const GAP = UI_PX * 2;
/** Narrower than this and chips page behind chevrons instead of squeezing. */
const MIN_CHIP = { icon: UI_PX * 20, labelPerChar: UI_PX * 5, labelPad: UI_PX * 14 } as const;
const CHEVRON_WIDTH = UI_PX * 11;
const MARK_SIZE = UI_PX * 7;

const minWidth = (chip: ChipSpec) =>
  chip.label
    ? chip.label.length * MIN_CHIP.labelPerChar +
      MIN_CHIP.labelPad +
      (chip.icon ? MIN_CHIP.icon / 2 : 0)
    : MIN_CHIP.icon;

// A row of tab chips. When they do not all fit, a window of them shows between chevron
// buttons; marked chips (e.g. something to claim) wear a "!" and so does the chevron
// pointing toward a hidden marked chip.
export class ChipStrip extends Map<string, Button> {
  private readonly order: string[];
  private readonly marks = new Map<string, Phaser.GameObjects.Container>();
  private readonly marked = new Set<string>();
  private readonly visibleCount: number;
  private readonly prev: Button | null = null;
  private readonly next: Button | null = null;
  private readonly prevMark: Phaser.GameObjects.Container | null = null;
  private readonly nextMark: Phaser.GameObjects.Container | null = null;
  private start = 0;
  private readonly chipWidth: number;

  constructor(
    private readonly scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    private readonly y: number,
    width: number,
    private readonly height: number,
    chips: ChipSpec[],
    onPick: (id: string) => void,
  ) {
    super();
    this.order = chips.map((chip) => chip.id);
    const widest = Math.max(...chips.map(minWidth));
    const fits = chips.length * widest + GAP * (chips.length - 1) <= width;
    const room = width - (fits ? 0 : (CHEVRON_WIDTH + GAP) * 2);
    this.visibleCount = fits
      ? chips.length
      : Math.max(1, Math.floor((room + GAP) / (widest + GAP)));
    const chipWidth =
      Math.floor((room - GAP * (this.visibleCount - 1)) / this.visibleCount / UI_PX) * UI_PX;
    this.chipWidth = chipWidth;
    for (const chip of chips) {
      const button = new Button(scene, 0, y, {
        width: chipWidth,
        height,
        icon: chip.icon,
        label: chip.label,
        iconSize: UI_PX * 9,
        fontSize: FONT_SIZE.small,
        align: 'center',
        sound: 'tab',
        onClick: () => onPick(chip.id),
      });
      const select = button.setSelected.bind(button);
      // Selecting a chip from code scrolls it into view too.
      button.setSelected = (selected: boolean) => {
        if (selected) this.reveal(chip.id);
        return select(selected);
      };
      const mark = this.badge(chipWidth - MARK_SIZE / 2, y);
      container.add([button, mark]);
      this.set(chip.id, button);
      this.marks.set(chip.id, mark);
    }
    if (!fits) {
      this.prev = this.chevron('left', 0, () => this.scroll(-1));
      this.next = this.chevron('right', width - CHEVRON_WIDTH, () => this.scroll(1));
      this.prevMark = this.badge(CHEVRON_WIDTH - MARK_SIZE / 2, y);
      this.nextMark = this.badge(width - MARK_SIZE / 2, y);
      container.add([this.prev, this.next, this.prevMark, this.nextMark]);
    }
    this.layout();
  }

  /** Flags a chip as needing attention. */
  setMarked(id: string, marked: boolean): void {
    if (marked) this.marked.add(id);
    else this.marked.delete(id);
    this.layout();
  }

  reveal(id: string): void {
    const index = this.order.indexOf(id);
    if (index < 0) return;
    if (index < this.start) this.start = index;
    else if (index >= this.start + this.visibleCount) this.start = index - this.visibleCount + 1;
    this.layout();
  }

  private scroll(step: number): void {
    const last = Math.max(0, this.order.length - this.visibleCount);
    this.start = Math.min(last, Math.max(0, this.start + step));
    this.layout();
  }

  private layout(): void {
    const offset = this.prev ? CHEVRON_WIDTH + GAP : 0;
    this.order.forEach((id, index) => {
      const button = this.get(id);
      const mark = this.marks.get(id);
      if (!button || !mark) return;
      const slot = index - this.start;
      const shown = slot >= 0 && slot < this.visibleCount;
      const x = offset + slot * (this.chipWidth + GAP);
      button.setVisible(shown).setX(x);
      mark.setVisible(shown && this.marked.has(id)).setX(x + this.chipWidth - MARK_SIZE / 2);
    });
    if (!this.prev || !this.next) return;
    const end = this.start + this.visibleCount;
    this.prev.setEnabled(this.start > 0);
    this.next.setEnabled(end < this.order.length);
    const hiddenMarked = (from: number, to: number) =>
      this.order.slice(from, to).some((id) => this.marked.has(id));
    this.prevMark?.setVisible(hiddenMarked(0, this.start));
    this.nextMark?.setVisible(hiddenMarked(end, this.order.length));
  }

  private chevron(direction: 'left' | 'right', x: number, onClick: () => void): Button {
    return new Button(this.scene, x, this.y, {
      width: CHEVRON_WIDTH,
      height: this.height,
      icon: iconKey(direction),
      iconSize: UI_PX * 7,
      align: 'center',
      sound: 'tab',
      onClick,
    });
  }

  private badge(x: number, y: number): Phaser.GameObjects.Container {
    const frame = createFrame(
      this.scene,
      -MARK_SIZE / 2,
      0,
      MARK_SIZE,
      MARK_SIZE,
      'woodButtonSelected',
    );
    const text = this.scene.add
      .text(0, MARK_SIZE / 2, '!', uiTextOnWood(FONT_SIZE.small))
      .setOrigin(0.5);
    return this.scene.add.container(x, y - UI_PX * 2, [frame, text]).setVisible(false);
  }
}
