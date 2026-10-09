import type * as Phaser from 'phaser';
import { iconImage } from './icons';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from './uiTheme';
import { Button } from './widgets/Button';
import { createFrame } from './widgets/Frame';
import { ProgressBar } from './widgets/ProgressBar';

export interface RowAction {
  label?: string;
  icon?: string;
  enabled?: boolean;
  selected?: boolean;
  width?: number;
  onClick: () => void;
}

export interface RowSpec {
  icon?: string;
  title: string;
  titleColor?: string;
  subtitle?: string;
  subtitleColor?: string;
  /** Makes the whole row a button. */
  onClick?: () => void;
  enabled?: boolean;
  selected?: boolean;
  actions?: RowAction[];
  progress?: { value: number; color?: number };
}

const PAD = UI_PX * 3;
const GAP = UI_PX * 2;
const ACTION_WIDTH = UI_PX * 30;
const BAR_HEIGHT = UI_PX * 4;
const ELLIPSIS = '…';

/** Shortens text with an ellipsis until it fits `maxWidth`. */
export function fitText(text: Phaser.GameObjects.Text, maxWidth: number): Phaser.GameObjects.Text {
  if (text.width <= maxWidth) return text;
  let value = text.text;
  while (value.length > 1 && text.width > maxWidth) {
    value = value.slice(0, -1);
    text.setText(value + ELLIPSIS);
  }
  return text;
}

// A parchment slot row: icon, title, optional subtitle and bar, and right-aligned actions.
export function slotRow(
  scene: Phaser.Scene,
  width: number,
  height: number,
  spec: RowSpec,
): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  if (spec.onClick) {
    const background = new Button(scene, 0, 0, {
      width,
      height,
      skin: 'slot',
      onClick: spec.onClick,
    })
      .setEnabled(spec.enabled ?? true)
      .setSelected(spec.selected ?? false);
    objects.push(background);
  } else {
    objects.push(createFrame(scene, 0, 0, width, height, spec.selected ? 'slotSelected' : 'slot'));
  }

  const iconSize = height - UI_PX * 6;
  let left = PAD;
  if (spec.icon) {
    const icon = iconImage(scene, spec.icon, left + iconSize / 2, height / 2, iconSize);
    if (spec.enabled === false) icon.setAlpha(0.6);
    objects.push(icon);
    left += iconSize + GAP;
  }

  let right = width - PAD;
  const actionHeight = Math.min(height - UI_PX * 6, UI_PX * 16);
  for (const action of [...(spec.actions ?? [])].reverse()) {
    const actionWidth = action.width ?? ACTION_WIDTH;
    right -= actionWidth;
    const button = new Button(scene, right, (height - actionHeight) / 2, {
      width: actionWidth,
      height: actionHeight,
      label: action.label,
      icon: action.icon,
      iconSize: UI_PX * 8,
      fontSize: FONT_SIZE.small,
      align: 'center',
      onClick: action.onClick,
    })
      .setEnabled(action.enabled ?? true)
      .setSelected(action.selected ?? false);
    objects.push(button);
    right -= GAP;
  }

  const textWidth = right - left;
  const lines = spec.subtitle !== undefined || spec.progress ? 2 : 1;
  const titleY = lines === 1 ? height / 2 : height / 2 - FONT_SIZE.body * 0.42;
  const title = scene.add
    .text(left, titleY, spec.title, uiText(FONT_SIZE.body, spec.titleColor ?? UI_TEXT.dark))
    .setOrigin(0, 0.5);
  objects.push(fitText(title, textWidth));
  const lowerY = height / 2 + FONT_SIZE.body * 0.45;
  if (spec.progress) {
    const barWidth = spec.subtitle ? Math.floor(textWidth * 0.4) : textWidth;
    const bar = new ProgressBar(scene, left, lowerY - BAR_HEIGHT / 2, barWidth, BAR_HEIGHT);
    bar.setProgress(spec.progress.value);
    if (spec.progress.color !== undefined) bar.setColor(spec.progress.color);
    objects.push(bar);
    if (spec.subtitle) left += barWidth + GAP;
  }
  if (spec.subtitle !== undefined) {
    const subtitle = scene.add
      .text(
        left,
        lowerY,
        spec.subtitle,
        uiText(FONT_SIZE.small, spec.subtitleColor ?? UI_TEXT.muted),
      )
      .setOrigin(0, 0.5);
    objects.push(fitText(subtitle, right - left));
  }
  return objects;
}

/** A row of category chips (icon buttons) spanning `width`; returns them by id. */
export function chipRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  y: number,
  width: number,
  height: number,
  chips: Array<{ id: string; icon?: string; label?: string }>,
  onPick: (id: string) => void,
): Map<string, Button> {
  const gap = UI_PX * 2;
  const chipWidth = Math.floor((width - gap * (chips.length - 1)) / chips.length / UI_PX) * UI_PX;
  const result = new Map<string, Button>();
  chips.forEach((chip, index) => {
    const button = new Button(scene, index * (chipWidth + gap), y, {
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
    container.add(button);
    result.set(chip.id, button);
  });
  return result;
}
