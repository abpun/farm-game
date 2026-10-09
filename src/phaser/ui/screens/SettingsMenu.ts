import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { downloadText, pickTextFile } from '../../../platform/fileTransfer';
import { getSettings } from '../../session';
import { iconKey } from '../uiTextures';
import { UI_TEXT } from '../uiTheme';
import { Modal } from '../widgets/Modal';
import type { ToastManager } from '../widgets/ToastManager';
import { openSettingsScreen } from './SettingsScreen';

const reload = () => window.location.reload();

export function openSettingsMenu(
  scene: Phaser.Scene,
  session: GameSession,
  toasts: ToastManager,
): void {
  Modal.open(scene, {
    title: 'Menu',
    actions: [
      {
        label: 'Settings',
        icon: iconKey('gear'),
        sound: null,
        onClick: () => openSettingsScreen(scene, getSettings(scene)),
      },
      {
        label: 'Save now',
        icon: iconKey('save'),
        onClick: () => {
          if (session.save()) toasts.show('Game saved', { icon: iconKey('save') });
          else toasts.show('Could not save', { color: UI_TEXT.danger });
        },
      },
      {
        label: 'Export save',
        icon: iconKey('export'),
        onClick: () => {
          const date = new Date().toISOString().slice(0, 10);
          downloadText(`farm-save-${date}.json`, session.exportSave());
          toasts.show('Save exported', { icon: iconKey('export') });
        },
      },
      {
        label: 'Import save',
        icon: iconKey('import'),
        onClick: async () => {
          const text = await pickTextFile();
          if (text === null) return;
          if (session.importSave(text)) reload();
          else toasts.show('That file is not a valid save', { color: UI_TEXT.danger });
        },
      },
      {
        label: 'Reset farm',
        icon: iconKey('reset'),
        onClick: () => confirmReset(scene, session),
      },
    ],
  });
}

function confirmReset(scene: Phaser.Scene, session: GameSession): void {
  Modal.open(scene, {
    title: 'Reset farm?',
    message: 'This deletes your save and starts a new farm. Export first if you want a backup.',
    actions: [
      {
        label: 'Yes, start over',
        icon: iconKey('reset'),
        onClick: () => {
          session.resetSave();
          reload();
        },
      },
      { label: 'Keep my farm', onClick: () => undefined },
    ],
  });
}
