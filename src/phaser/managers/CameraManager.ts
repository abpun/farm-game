import type * as Phaser from 'phaser';
import type { Point } from '../iso/IsoGrid';
import { CAMERA, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE } from '../layout';

// Zoom steps keep each art pixel an integer number of screen pixels.
const ZOOM_LEVELS = [1, 2, 3, 4, 5].map((screenPixels) => screenPixels / PIXEL_SCALE);
const DEFAULT_ZOOM_INDEX = 2;
const PAN_MS = 700;

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragStart {
  x: number;
  y: number;
  scrollX: number;
  scrollY: number;
}

export class CameraManager {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private zoomIndex = DEFAULT_ZOOM_INDEX;
  private dragStart: DragStart | null = null;
  private dragged = false;

  constructor(
    scene: Phaser.Scene,
    world: Bounds,
    focus: Point,
    /** While true, drags belong to something else (e.g. sweeping across fields). */
    private readonly locked: () => boolean = () => false,
  ) {
    this.camera = scene.cameras.main;
    this.camera.setBounds(world.x, world.y, world.width, world.height);
    this.applyZoom();
    this.focus(focus);

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.beginDrag(pointer));
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.drag(pointer));
    scene.input.on('pointerup', () => (this.dragStart = null));
    scene.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.stepZoom(dy > 0 ? -1 : 1),
    );
  }

  // True when the current/last gesture was a pan, so taps can ignore it.
  get isDragging(): boolean {
    return this.dragged;
  }

  focus(point: Point): void {
    const zoom = this.camera.zoom;
    this.camera.centerOn(
      point.x + (GAME_WIDTH / 2 - CAMERA.focusOnScreen.x) / zoom,
      point.y + (GAME_HEIGHT / 2 - CAMERA.focusOnScreen.y) / zoom,
    );
  }

  /** Glides (or jumps) so the point sits where the farm focus normally sits. */
  panTo(point: Point, animate: boolean): void {
    const zoom = this.camera.zoom;
    const x = point.x + (GAME_WIDTH / 2 - CAMERA.focusOnScreen.x) / zoom;
    const y = point.y + (GAME_HEIGHT / 2 - CAMERA.focusOnScreen.y) / zoom;
    if (!animate) {
      this.camera.centerOn(x, y);
      return;
    }
    this.camera.pan(x, y, PAN_MS, 'Sine.easeInOut');
  }

  private beginDrag(pointer: Phaser.Input.Pointer): void {
    this.dragged = false;
    this.dragStart = {
      x: pointer.x,
      y: pointer.y,
      scrollX: this.camera.scrollX,
      scrollY: this.camera.scrollY,
    };
  }

  private drag(pointer: Phaser.Input.Pointer): void {
    if (!this.dragStart || !pointer.isDown || this.locked()) return;
    const dx = pointer.x - this.dragStart.x;
    const dy = pointer.y - this.dragStart.y;
    if (!this.dragged && Math.hypot(dx, dy) < CAMERA.dragThreshold) return;
    this.dragged = true;
    this.camera.setScroll(
      Math.round(this.dragStart.scrollX - dx / this.camera.zoom),
      Math.round(this.dragStart.scrollY - dy / this.camera.zoom),
    );
  }

  private stepZoom(step: number): void {
    const next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, this.zoomIndex + step));
    if (next === this.zoomIndex) return;
    this.zoomIndex = next;
    this.applyZoom();
  }

  private applyZoom(): void {
    this.camera.setZoom(ZOOM_LEVELS[this.zoomIndex] ?? 1);
  }
}
