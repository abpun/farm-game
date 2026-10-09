import type * as Phaser from 'phaser';
import { playCue } from '../../audio/playCue';
import { reducedMotion } from '../../fx/prefs';
import { Panel } from './Panel';

export type DrawerSide = 'left' | 'right';

const SLIDE_MS = 160;
const SLIDE_DISTANCE = 48;
const DRAWER_DEPTH = 500;

export const DRAWER_EVENTS = { opened: 'drawer-opened', closed: 'drawer-closed' } as const;

// A panel that slides in beside a dock and out again; it starts closed.
export class Drawer extends Panel {
  private readonly restX: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    private readonly side: DrawerSide,
  ) {
    super(scene, x, y, width, height, { title, onClose: () => this.close() });
    this.restX = x;
    this.setDepth(DRAWER_DEPTH).setVisible(false);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  open(): void {
    if (this.isOpen) return;
    this.emit(DRAWER_EVENTS.opened);
    playCue(this.scene, 'open');
    const offset = this.slideOffset();
    this.setVisible(true)
      .setAlpha(0)
      .setX(this.restX + offset);
    this.scene.tweens.add({
      targets: this,
      x: this.restX,
      alpha: 1,
      duration: SLIDE_MS,
      ease: 'Quad.easeOut',
    });
  }

  close(): void {
    if (!this.isOpen) return;
    this.emit(DRAWER_EVENTS.closed);
    playCue(this.scene, 'close');
    const offset = this.slideOffset();
    this.scene.tweens.add({
      targets: this,
      x: this.restX + offset,
      alpha: 0,
      duration: SLIDE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => this.setVisible(false),
    });
  }

  // With reduced motion the drawer only fades.
  private slideOffset(): number {
    if (reducedMotion(this.scene)) return 0;
    return this.side === 'right' ? SLIDE_DISTANCE : -SLIDE_DISTANCE;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }
}
