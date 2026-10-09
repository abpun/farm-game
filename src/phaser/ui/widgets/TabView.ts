import * as Phaser from 'phaser';
import { UI_PX } from '../uiTheme';
import { Button } from './Button';
import { createFrame } from './Frame';
import { PANEL_INSET } from './Panel';

export interface TabSpec {
  id: string;
  label: string;
  icon?: string;
}

const TAB_HEIGHT = UI_PX * 16;
const TAB_GAP = UI_PX * 2;
const TAB_OVERLAP = UI_PX * 3;

export class TabView extends Phaser.GameObjects.Container {
  readonly pageWidth: number;
  readonly pageHeight: number;
  private readonly pages = new Map<string, Phaser.GameObjects.Container>();
  private readonly tabs = new Map<string, Button>();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    specs: TabSpec[],
  ) {
    super(scene, x, y);
    const panelTop = TAB_HEIGHT - TAB_OVERLAP;
    this.add(createFrame(scene, 0, panelTop, width, height - panelTop, 'panel').setInteractive());
    this.pageWidth = width - PANEL_INSET * 2;
    this.pageHeight = height - panelTop - PANEL_INSET * 2;

    const tabWidth =
      Math.floor((width - TAB_GAP * (specs.length - 1)) / specs.length / UI_PX) * UI_PX;
    specs.forEach((spec, index) => {
      const tab = new Button(scene, index * (tabWidth + TAB_GAP), 0, {
        width: tabWidth,
        height: TAB_HEIGHT,
        label: spec.label,
        icon: spec.icon,
        iconSize: UI_PX * 8,
        skin: 'tab',
        align: 'center',
        onClick: () => this.select(spec.id),
      });
      const page = scene.add.container(PANEL_INSET, panelTop + PANEL_INSET);
      this.tabs.set(spec.id, tab);
      this.pages.set(spec.id, page);
      this.add([page, tab]);
    });
    const first = specs[0];
    if (first) this.select(first.id);
    scene.add.existing(this);
  }

  page(id: string): Phaser.GameObjects.Container {
    const page = this.pages.get(id);
    if (!page) throw new Error(`Unknown tab ${id}`);
    return page;
  }

  select(id: string): void {
    this.pages.forEach((page, pageId) => page.setVisible(pageId === id));
    this.tabs.forEach((tab, tabId) => tab.setSelected(tabId === id));
  }
}
