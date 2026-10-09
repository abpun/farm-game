import type * as Phaser from 'phaser';
import type { Settings, VolumeChannel } from '@core/settings/settings';
import type { SettingsStore } from '@core/settings/SettingsStore';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Dialog } from '../widgets/Dialog';
import { FocusRing, type Focusable } from '../widgets/FocusRing';
import { Modal } from '../widgets/Modal';
import { Slider } from '../widgets/Slider';

type Flag = 'screenShake' | 'visualEffects' | 'reducedMotion';

const VOLUMES: Array<{ channel: VolumeChannel; label: string }> = [
  { channel: 'master', label: 'Master' },
  { channel: 'music', label: 'Music' },
  { channel: 'sfx', label: 'Effects' },
  { channel: 'ambient', label: 'Ambience' },
];

const FLAGS: Array<{ flag: Flag; label: string; hint: string }> = [
  { flag: 'screenShake', label: 'Screen shake', hint: 'A small shake on big moments' },
  { flag: 'visualEffects', label: 'Visual effects', hint: 'Particles, ripples, floating numbers' },
  { flag: 'reducedMotion', label: 'Reduced motion', hint: 'No sliding, swaying or bursts' },
];

const WIDTH = UI_PX * 180;
const HEIGHT = UI_PX * 196;
const HEADER = UI_PX * 10;
const ROW = UI_PX * 17;
const FLAG_ROW = UI_PX * 20;
const CONTROL = UI_PX * 14;
const LABEL_WIDTH = UI_PX * 44;
const VALUE_WIDTH = UI_PX * 18;
const TOGGLE_WIDTH = UI_PX * 30;
const STEP = 0.05;
const RING_DEPTH = 960;
const PERCENT = 100;

interface VolumeRow {
  slider: Slider;
  mute: Button;
  value: Phaser.GameObjects.Text;
}

// Audio levels and presentation preferences. Every change applies and saves at once,
// so closing the screen (X, backdrop or Esc) never loses anything.
export function openSettingsScreen(scene: Phaser.Scene, settings: SettingsStore): void {
  const dialog = Dialog.open(scene, { title: 'Settings', width: WIDTH, height: HEIGHT });
  const page = dialog.content;
  const width = dialog.innerWidth;
  const focusables: Focusable[] = [];
  let y = 0;

  page.add(header(scene, 'Sound', y));
  y += HEADER;
  const volumes = new Map<VolumeChannel, VolumeRow>();
  for (const { channel, label } of VOLUMES) {
    page.add(scene.add.text(0, y + CONTROL / 2, label, uiText(FONT_SIZE.body)).setOrigin(0, 0.5));
    const mute = new Button(scene, LABEL_WIDTH, y, {
      width: CONTROL,
      height: CONTROL,
      icon: iconKey('sound'),
      iconSize: UI_PX * 8,
      align: 'center',
      sound: 'toggle',
      onClick: () => settings.setMuted(channel, !settings.get().muted[channel]),
    });
    const sliderX = LABEL_WIDTH + CONTROL + UI_PX * 3;
    const slider = new Slider(scene, sliderX, y, {
      width: width - sliderX - VALUE_WIDTH - UI_PX * 2,
      height: CONTROL,
      value: settings.get().volume[channel],
      step: STEP,
      onChange: (value) => settings.setVolume(channel, value),
    });
    const value = scene.add
      .text(width, y + CONTROL / 2, '', uiText(FONT_SIZE.body))
      .setOrigin(1, 0.5);
    page.add([mute, slider, value]);
    volumes.set(channel, { slider, mute, value });
    focusables.push({ target: mute, activate: () => mute.press() });
    focusables.push({ target: slider, adjust: (direction) => slider.nudge(direction) });
    y += ROW;
  }

  y += UI_PX * 2;
  page.add(header(scene, 'Visuals', y));
  y += HEADER;
  const toggles = new Map<Flag, Button>();
  for (const { flag, label, hint } of FLAGS) {
    page.add([
      scene.add.text(0, y, label, uiText(FONT_SIZE.body)),
      scene.add.text(0, y + UI_PX * 9, hint, uiText(FONT_SIZE.small, UI_TEXT.muted)),
    ]);
    const toggle = new Button(scene, width - TOGGLE_WIDTH, y + UI_PX * 2, {
      width: TOGGLE_WIDTH,
      height: CONTROL,
      label: '',
      align: 'center',
      sound: 'toggle',
      onClick: () => settings.setFlag(flag, !settings.get()[flag]),
    });
    page.add(toggle);
    toggles.set(flag, toggle);
    focusables.push({ target: toggle, activate: () => toggle.press() });
    y += FLAG_ROW;
  }

  const buttonWidth = (width - UI_PX * 3) / 2;
  const buttonY = dialog.innerHeight - CONTROL - UI_PX * 4;
  const restore = new Button(scene, 0, buttonY, {
    width: buttonWidth,
    height: CONTROL + UI_PX * 4,
    label: 'Restore defaults',
    icon: iconKey('reset'),
    iconSize: UI_PX * 8,
    align: 'center',
    onClick: () => confirmRestore(scene, settings),
  });
  const done = new Button(scene, width - buttonWidth, buttonY, {
    width: buttonWidth,
    height: CONTROL + UI_PX * 4,
    label: 'Done',
    align: 'center',
    sound: null,
    onClick: () => dialog.close(),
  });
  page.add([restore, done]);
  focusables.push({ target: restore, activate: () => restore.press() });
  focusables.push({ target: done, activate: () => done.press() });

  const sync = (current: Settings) => {
    volumes.forEach((row, channel) => {
      const muted = current.muted[channel];
      row.slider.setValue(current.volume[channel]);
      row.mute.setIcon(iconKey(muted ? 'mute' : 'sound')).setSelected(muted);
      row.value
        .setText(muted ? 'Off' : `${Math.round(current.volume[channel] * PERCENT)}%`)
        .setColor(muted ? UI_TEXT.danger : UI_TEXT.dark);
    });
    toggles.forEach((toggle, flag) =>
      toggle.setLabel(current[flag] ? 'On' : 'Off').setSelected(current[flag]),
    );
  };
  sync(settings.get());
  const ring = new FocusRing(scene, focusables, RING_DEPTH);
  dialog.onClose(settings.onChange(sync));
  dialog.onClose(() => ring.destroy());
}

function header(scene: Phaser.Scene, text: string, y: number): Phaser.GameObjects.Text {
  return scene.add.text(0, y, text.toUpperCase(), uiText(FONT_SIZE.small, UI_TEXT.muted));
}

function confirmRestore(scene: Phaser.Scene, settings: SettingsStore): void {
  Modal.open(scene, {
    title: 'Restore defaults?',
    message: 'Volumes and visual options go back to their defaults. Your farm is not affected.',
    actions: [
      { label: 'Restore', icon: iconKey('reset'), onClick: () => settings.reset() },
      { label: 'Cancel', sound: 'click', onClick: () => undefined },
    ],
  });
}
