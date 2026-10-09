import type * as Phaser from 'phaser';
import type { CatalogItem, PlacedObject } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { finishedJobs } from '@core/systems/productionQueue';
import { frontFenceKey, isHousingArt, YARD } from '../art/BuildingArtist';
import { animalTextureKey, EXTRA_TEXTURES } from '../art/ExtraArtist';
import { addArt, seededRandom } from '../art/paint';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import { textStyle, TEXT } from '../theme';
import { formatDuration } from '../ui/format';
import { itemIconKey } from '../ui/itemIcons';
import { iconKey } from '../ui/uiTextures';

const CONSTRUCTION_ALPHA = 0.55;
const CONSTRUCTION_TINT = 0xc9b9a0;
const BUBBLE_RISE = 1.5;
const BOB_MS = 700;
const WANDER = { ms: 2600, jitter: 1800, distance: 0.18 } as const;
const STATUS_DEPTH = 9000;

interface Critter {
  image: Phaser.GameObjects.Image;
  home: { col: number; row: number };
}

// Everything on the map that shows a building's state: scaffolding, upgrade stars,
// a bubble for ready output or hungry animals, and the animals in their yard.
export class BuildingView {
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly bubbleIcon: Phaser.GameObjects.Image;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly stars: Phaser.GameObjects.Container;
  private readonly fence: Phaser.GameObjects.Image | null;
  private readonly critters: Critter[] = [];
  private shownIcon = '';
  private shownLevel = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
    private readonly object: PlacedObject,
    item: CatalogItem,
    private readonly sprite: Phaser.GameObjects.Image,
  ) {
    const depth = sprite.depth;
    const top = grid.toScreen(object.col + 1, object.row + 1);
    const anchorY = top.y - grid.tileH * BUBBLE_RISE - grid.tileH;
    const background = scene.add.image(0, 0, EXTRA_TEXTURES.bubble).setScale(PIXEL_SCALE);
    this.bubbleIcon = scene.add.image(0, -PIXEL_SCALE, iconKey('hammer')).setScale(PIXEL_SCALE);
    this.timer = scene.add
      .text(0, background.displayHeight / 2 + 4, '', textStyle(20, TEXT.base))
      .setOrigin(0.5, 0);
    this.bubble = scene.add
      .container(top.x, anchorY, [background, this.bubbleIcon, this.timer])
      .setDepth(STATUS_DEPTH)
      .setVisible(false);
    scene.tweens.add({
      targets: this.bubble,
      y: anchorY - 6,
      duration: BOB_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.stars = scene.add.container(top.x - grid.tileW * 0.55, anchorY + grid.tileH * 0.6);
    this.stars.setDepth(depth + 1);

    this.fence = isHousingArt(item.art)
      ? addArt(scene, sprite.x, sprite.y, frontFenceKey(item.art)).setDepth(depth + 2)
      : null;
    this.refresh();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.bubble);
    this.bubble.destroy();
    this.stars.destroy();
    this.fence?.destroy();
    this.critters.forEach((critter) => {
      this.scene.tweens.killTweensOf(critter.image);
      critter.image.destroy();
    });
  }

  refresh(): void {
    const { buildings } = this.session;
    if (!buildings.isBuilding(this.object.id)) return;
    const building = buildings.isOperational(this.object.id);
    this.sprite
      .setAlpha(building ? 1 : CONSTRUCTION_ALPHA)
      .setTint(building ? 0xffffff : CONSTRUCTION_TINT);
    if (!building) {
      const remaining = buildings.constructionRemaining(this.object.id);
      this.showBubble(iconKey('hammer'), formatDuration(remaining));
    } else {
      this.showBubble(this.statusIcon(), '');
    }
    this.syncStars(buildings.record(this.object.id).level);
    this.syncCritters();
  }

  private statusIcon(): string {
    const { buildings, ranch, content, time } = this.session;
    const record = buildings.record(this.object.id);
    const animal = content.animalFor(this.object.itemId);
    if (animal) {
      if (record.animals.some((a) => ranch.status(a) === 'ready')) {
        return itemIconKey(content, animal.product);
      }
      if (record.animals.some((a) => ranch.status(a) === 'hungry')) {
        return itemIconKey(content, animal.feed);
      }
      return '';
    }
    const done = finishedJobs(record, time.now())[0];
    if (!done) return '';
    const output = Object.keys(content.recipes.get(done.recipeId).outputs)[0];
    return output ? itemIconKey(content, output) : '';
  }

  private showBubble(icon: string, timer: string): void {
    this.timer.setText(timer);
    if (icon === this.shownIcon) return;
    this.shownIcon = icon;
    this.bubble.setVisible(icon !== '');
    if (!icon) return;
    this.bubbleIcon.setTexture(icon);
    const scale = Math.max(
      1,
      Math.floor((10 * PIXEL_SCALE) / Math.max(this.bubbleIcon.width, this.bubbleIcon.height)),
    );
    this.bubbleIcon.setScale(Math.min(PIXEL_SCALE, scale));
  }

  private syncStars(level: number): void {
    if (level === this.shownLevel) return;
    this.shownLevel = level;
    this.stars.removeAll(true);
    for (let i = 1; i < level; i++) {
      const star = this.scene.add
        .image(i * 8 * PIXEL_SCALE, 0, iconKey('star'))
        .setScale(PIXEL_SCALE);
      this.stars.add(star);
    }
  }

  private syncCritters(): void {
    const animals = this.session.buildings.record(this.object.id).animals;
    while (this.critters.length > animals.length) {
      const critter = this.critters.pop();
      if (critter) {
        this.scene.tweens.killTweensOf(critter.image);
        critter.image.destroy();
      }
    }
    animals.slice(this.critters.length).forEach((animal, offset) => {
      this.critters.push(this.addCritter(animal.animalId, this.critters.length + offset));
    });
  }

  // Spreads animals over the yard in a stable pattern, then lets each amble about.
  private addCritter(animalId: string, index: number): Critter {
    const random = seededRandom(this.object.id * 31 + index * 7);
    const span = { col: YARD.col1 - YARD.col0 - 0.5, row: YARD.row1 - YARD.row0 - 0.35 };
    const home = {
      col: this.object.col + YARD.col0 + 0.25 + random() * span.col,
      row: this.object.row + YARD.row0 + 0.15 + random() * span.row,
    };
    const at = this.grid.toScreen(home.col, home.row);
    const image = addArt(this.scene, at.x, at.y, animalTextureKey(animalId), 0.5, 1)
      .setDepth(this.sprite.depth + 1)
      .setFlipX(random() > 0.5);
    const critter = { image, home };
    this.wander(critter, random);
    return critter;
  }

  private wander(critter: Critter, random: () => number): void {
    const target = this.grid.toScreen(
      critter.home.col + (random() - 0.5) * WANDER.distance * 2,
      critter.home.row + (random() - 0.5) * WANDER.distance * 2,
    );
    critter.image.setFlipX(target.x > critter.image.x);
    this.scene.tweens.add({
      targets: critter.image,
      x: Math.round(target.x),
      y: Math.round(target.y),
      duration: WANDER.ms,
      delay: random() * WANDER.jitter,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (critter.image.active) this.wander(critter, random);
      },
    });
  }
}
