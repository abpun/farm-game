import * as Phaser from 'phaser';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from './Button';

export const NAV_HEIGHT = UI_PX * 14;

export type RowRenderer<T> = (
  item: T,
  width: number,
  height: number,
) => Phaser.GameObjects.GameObject[];

// Fixed-height rows split into pages with prev/next controls when they don't all fit.
// Phaser 4 masks are canvas-only, so paging keeps lists crisp and touch-friendly.
export class PagedList<T> extends Phaser.GameObjects.Container {
  private readonly rows: Phaser.GameObjects.Container;
  private readonly nav: Phaser.GameObjects.Container;
  private readonly pageLabel: Phaser.GameObjects.Text;
  private readonly empty: Phaser.GameObjects.Text;
  private readonly prevButton: Button;
  private readonly nextButton: Button;
  private items: T[] = [];
  private page = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly listWidth: number,
    private readonly listHeight: number,
    private readonly rowHeight: number,
    private readonly gap: number,
    private readonly render: RowRenderer<T>,
  ) {
    super(scene, x, y);
    this.rows = scene.add.container(0, 0);
    const navButton = (x: number, icon: 'left' | 'right', step: number) =>
      new Button(scene, x, 0, {
        width: NAV_HEIGHT,
        height: NAV_HEIGHT,
        icon: iconKey(icon),
        iconSize: UI_PX * 7,
        align: 'center',
        onClick: () => this.turn(step),
      });
    this.prevButton = navButton(0, 'left', -1);
    this.nextButton = navButton(listWidth - NAV_HEIGHT, 'right', 1);
    this.pageLabel = scene.add
      .text(listWidth / 2, NAV_HEIGHT / 2, '', uiText(FONT_SIZE.small, UI_TEXT.muted))
      .setOrigin(0.5);
    this.nav = scene.add.container(0, listHeight - NAV_HEIGHT, [
      this.prevButton,
      this.pageLabel,
      this.nextButton,
    ]);
    this.empty = scene.add
      .text(listWidth / 2, UI_PX * 20, '', {
        ...uiText(FONT_SIZE.body, UI_TEXT.muted),
        align: 'center',
        wordWrap: { width: listWidth - UI_PX * 8 },
      })
      .setOrigin(0.5, 0);
    this.add([this.rows, this.nav, this.empty]);
    scene.add.existing(this);
  }

  get perPage(): number {
    const usable = this.listHeight - NAV_HEIGHT;
    return Math.max(1, Math.floor((usable + this.gap) / (this.rowHeight + this.gap)));
  }

  /** Replaces the items, keeping the page where possible so live refreshes don't jump. */
  setItems(items: T[], emptyMessage = ''): this {
    this.items = items;
    this.empty.setText(items.length === 0 ? emptyMessage : '');
    this.page = Math.min(this.page, this.pageCount() - 1);
    this.draw();
    return this;
  }

  resetPage(): this {
    this.page = 0;
    this.draw();
    return this;
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.items.length / this.perPage));
  }

  private turn(step: number): void {
    this.page = Math.max(0, Math.min(this.pageCount() - 1, this.page + step));
    this.draw();
  }

  private draw(): void {
    this.rows.removeAll(true);
    const start = this.page * this.perPage;
    this.items.slice(start, start + this.perPage).forEach((item, index) => {
      const row = this.scene.add.container(0, index * (this.rowHeight + this.gap));
      row.add(this.render(item, this.listWidth, this.rowHeight));
      this.rows.add(row);
    });
    const pages = this.pageCount();
    this.nav.setVisible(pages > 1);
    this.pageLabel.setText(`${this.page + 1} / ${pages}`);
    this.prevButton.setEnabled(this.page > 0);
    this.nextButton.setEnabled(this.page < pages - 1);
  }
}
