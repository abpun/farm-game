import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { CAVE_TEXTURES } from '../art/CaveArtist';
import { boatKey, HARBOR_TEXTURES, isletKey } from '../art/HarborArtist';
import { addArt } from '../art/paint';
import { seasonalTexture } from '../art/seasonLooks';
import {
  WATERFALL_CLIFF,
  WATERFALL_FRAMES,
  waterfallFoamKey,
  waterfallKey,
} from '../art/WaterfallArtist';
import { WILD_TEXTURES } from '../art/WildArtist';
import { effectsEnabled, reducedMotion } from '../fx/prefs';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import { dressWorld } from '../map/dressing';
import { mapToScreen, toMap, WORLD, type MapPoint, type WorldFeature } from '../map/WorldMap';
import type { WorldShape } from '../map/WorldShape';
import { TERRAIN_DEPTH } from './TerrainTiles';

const DEPTH_PER_V = 10;
const ISLAND_DEPTH = TERRAIN_DEPTH.land + 10;
const WATERFALL_FRAME_MS = 110;
const BOB = { distance: PIXEL_SCALE, ms: 1400 };
const GLOW_MS = 1200;
const SPARKLE = { everyMs: 3200, ms: 500 };
const SAIL_MS = 1600;
const DOCK_OFFSET = { boathouse: { u: -3.6, v: -1.2 }, goods: { u: 2.6, v: -0.4 } };
const MOORING = { u: 1.7, v: 6.4 };

/** What the player tapped on the map, for the scene to act on. */
export type LandmarkTap =
  { kind: 'mine' } | { kind: 'harbor' } | { kind: 'discovery'; id: string; name: string };

interface Hotspot {
  feature: WorldFeature;
  image: Phaser.GameObjects.Image;
  tap: LandmarkTap;
}

const DRESSING_TEXTURES: Record<string, string> = {
  reeds: WILD_TEXTURES.reeds,
  lily: WILD_TEXTURES.lily,
  shell: WILD_TEXTURES.shell,
  driftwood: WILD_TEXTURES.driftwood,
  signpost: WILD_TEXTURES.signpost,
  hedge: WILD_TEXTURES.hedge,
};
const SEASONAL_DRESSING = new Set(['reeds', 'lily', 'hedge']);

// The valley's hand-placed landmarks: cave, waterfall, harbor and boat, lighthouse, bridges,
// islands and hidden discoveries, plus riverbank and beach dressing.
export class Landmarks {
  private readonly hotspots: Hotspot[] = [];
  private readonly seasonal: Array<{ image: Phaser.GameObjects.Image; baseKey: string }> = [];
  private readonly discoveryImages = new Map<string, Phaser.GameObjects.Image>();
  private cave!: Phaser.GameObjects.Image;
  private boat!: Phaser.GameObjects.Image;
  private forSale!: Phaser.GameObjects.Image;
  private boatHome = { x: 0, y: 0 };
  private boatAway: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
    shape: WorldShape,
    seasonId: string,
  ) {
    for (const feature of WORLD.features) this.place(feature);
    for (const bridge of WORLD.bridges) {
      this.image(bridge, HARBOR_TEXTURES.bridge, 0.5, 0.6, 1);
    }
    WORLD.islands.forEach((island) =>
      this.image(island, isletKey(island.size), 0.5, 1).setDepth(ISLAND_DEPTH),
    );
    for (const item of dressWorld(shape)) {
      const point = toMap(item.col, item.row);
      const key = DRESSING_TEXTURES[item.kind] ?? WILD_TEXTURES.shell;
      const image = this.image(point, key, 0.5, 1, item.kind === 'lily' ? -2 : 1);
      if (SEASONAL_DRESSING.has(item.kind)) this.seasonal.push({ image, baseKey: key });
    }
    this.setSeason(seasonId);
    this.refresh();
    const { bus } = session;
    const offs = [
      bus.on('LevelUp', () => this.refresh()),
      bus.on('DiscoveryFound', () => this.refresh()),
      bus.on('BoatUpgraded', () => this.refresh()),
      bus.on('FishingCast', ({ spotId }) => this.sailTo(spotId)),
    ];
    scene.time.addEvent({ delay: SPARKLE.everyMs, loop: true, callback: () => this.sparkle() });
    scene.events.once('shutdown', () => offs.forEach((off) => off()));
  }

  setSeason(seasonId: string): void {
    for (const { image, baseKey } of this.seasonal) {
      image.setTexture(seasonalTexture(this.scene.textures, baseKey, seasonId));
    }
  }

  /** The landmark under a world point, if it can be tapped. */
  tapAt(x: number, y: number): LandmarkTap | null {
    for (const hotspot of this.hotspots) {
      if (hotspot.image.visible && hotspot.image.getBounds().contains(x, y)) return hotspot.tap;
    }
    return null;
  }

  /** Brings the boat home once the line is reeled in or the fish escaped. */
  update(): void {
    if (this.boatAway && !this.session.fishing.cast()) this.sailHome();
  }

  pointOf(featureId: string): { x: number; y: number } | null {
    const feature = WORLD.features.find((f) => f.id === featureId);
    return feature ? this.screen(feature) : null;
  }

  private place(feature: WorldFeature): void {
    switch (feature.kind) {
      case 'cave':
        this.cave = this.image(feature, CAVE_TEXTURES.open, 0.5, 1, 2);
        this.hotspots.push({ feature, image: this.cave, tap: { kind: 'mine' } });
        return;
      case 'waterfall':
        return this.placeWaterfall(feature);
      case 'harbor':
        return this.placeHarbor(feature);
      case 'lighthouse':
        return this.placeLighthouse(feature);
      case 'spot':
        return;
      default:
        return this.placeDiscovery(feature);
    }
  }

  private placeDiscovery(feature: WorldFeature): void {
    const id = feature.discovery;
    if (!id || !this.session.content.discoveries.has(id)) return;
    const image = this.image(feature, discoveryTexture(feature.kind, false), 0.5, 1, 2);
    const name = this.session.content.discoveries.get(id).name;
    this.discoveryImages.set(id, image);
    this.hotspots.push({ feature, image, tap: { kind: 'discovery', id, name } });
  }

  private placeWaterfall(feature: WorldFeature): void {
    this.image(feature, WATERFALL_CLIFF, 0.5, 1, 2);
    const fall = this.image(feature, waterfallKey(0), 0.5, 1, 3);
    const foam = this.image(feature, waterfallFoamKey(0), 0.5, 0.5, 4);
    let frame = 0;
    this.scene.time.addEvent({
      delay: WATERFALL_FRAME_MS,
      loop: true,
      callback: () => {
        if (reducedMotion(this.scene)) return;
        frame = (frame + 1) % WATERFALL_FRAMES;
        fall.setTexture(waterfallKey(frame));
        foam.setTexture(waterfallFoamKey(frame));
      },
    });
  }

  private placeHarbor(feature: WorldFeature): void {
    const dock = this.image(feature, HARBOR_TEXTURES.dock, 0.5, 0, 1);
    dock.setDepth(this.depthAt(feature) - 1);
    const shed = this.image(
      offset(feature, DOCK_OFFSET.boathouse),
      HARBOR_TEXTURES.boathouse,
      0.5,
      1,
      2,
    );
    this.image(offset(feature, DOCK_OFFSET.goods), HARBOR_TEXTURES.goods, 0.5, 1, 2);
    this.forSale = this.image(
      offset(feature, { u: 1, v: 0.4 }),
      HARBOR_TEXTURES.forSale,
      0.5,
      1,
      3,
    );
    const mooring = offset(feature, MOORING);
    this.boat = this.image(mooring, boatKey('rowboat'), 0.5, 1, 2);
    this.boatHome = { x: this.boat.x, y: this.boat.y };
    this.scene.tweens.add({
      targets: this.boat,
      y: this.boat.y + BOB.distance,
      duration: BOB.ms,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const tap: LandmarkTap = { kind: 'harbor' };
    for (const image of [dock, shed, this.boat, this.forSale]) {
      this.hotspots.push({ feature, image, tap });
    }
  }

  private placeLighthouse(feature: WorldFeature): void {
    const tower = this.image(feature, HARBOR_TEXTURES.lighthouse, 0.5, 1, 2);
    const glow = addArt(
      this.scene,
      tower.x,
      tower.y - tower.displayHeight + 14 * PIXEL_SCALE,
      HARBOR_TEXTURES.lighthouseGlow,
      0.5,
      0.5,
    )
      .setDepth(tower.depth + 1)
      .setAlpha(0.3);
    this.scene.tweens.add({ targets: glow, alpha: 1, duration: GLOW_MS, yoyo: true, repeat: -1 });
    if (feature.discovery) {
      this.hotspots.push({
        feature,
        image: tower,
        tap: {
          kind: 'discovery',
          id: feature.discovery,
          name: this.session.content.discoveries.get(feature.discovery).name,
        },
      });
    }
  }

  private refresh(): void {
    const { mining, exploration, fishing } = this.session;
    this.cave.setTexture(mining.isUnlocked() ? CAVE_TEXTURES.open : CAVE_TEXTURES.boarded);
    for (const [id, image] of this.discoveryImages) {
      const found = exploration.isFound(id);
      const feature = this.hotspots.find((h) => h.image === image)?.feature;
      if (!feature) continue;
      if (feature.kind === 'rockfall') image.setVisible(!found);
      else image.setTexture(discoveryTexture(feature.kind, found));
    }
    const boat = fishing.boat();
    this.boat.setTexture(boatKey(boat?.id ?? 'rowboat'));
    this.forSale.setVisible(!boat);
  }

  private sailTo(spotId: string): void {
    const target = WORLD.seaSpots[spotId];
    if (!target || !this.session.fishing.boat()) return;
    this.boatAway = spotId;
    const at = this.screen(target);
    this.moveBoat(at.x, at.y);
  }

  private sailHome(): void {
    this.boatAway = null;
    this.moveBoat(this.boatHome.x, this.boatHome.y);
  }

  private moveBoat(x: number, y: number): void {
    if (reducedMotion(this.scene)) {
      this.boat.setPosition(x, y);
      return;
    }
    this.scene.tweens.add({ targets: this.boat, x, duration: SAIL_MS, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: this.boat, y, duration: SAIL_MS, ease: 'Sine.easeInOut' });
    this.boat.setDepth(y / (this.grid.tileH / 2 / DEPTH_PER_V) + 2);
  }

  // A glint now and then over things still waiting to be found.
  private sparkle(): void {
    if (!effectsEnabled(this.scene) || reducedMotion(this.scene)) return;
    const waiting = [...this.discoveryImages].filter(
      ([id, image]) => image.visible && this.session.exploration.blocker(id) === null,
    );
    const pick = waiting[Math.floor(Math.random() * waiting.length)];
    if (!pick) return;
    const [, image] = pick;
    const glint = addArt(
      this.scene,
      image.x,
      image.y - image.displayHeight,
      WILD_TEXTURES.sparkle,
      0.5,
      0.5,
    )
      .setDepth(image.depth + 1)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: glint,
      alpha: 1,
      duration: SPARKLE.ms,
      yoyo: true,
      onComplete: () => glint.destroy(),
    });
  }

  private screen(point: MapPoint) {
    return mapToScreen(this.grid.tileW, this.grid.tileH, point);
  }

  private depthAt(point: MapPoint): number {
    return point.v * DEPTH_PER_V;
  }

  private image(
    point: MapPoint,
    key: string,
    originX: number,
    originY: number,
    layer = 0,
  ): Phaser.GameObjects.Image {
    const at = this.screen(point);
    return addArt(this.scene, at.x, at.y, key, originX, originY).setDepth(
      this.depthAt(point) + layer,
    );
  }
}

const offset = (point: MapPoint, by: MapPoint): MapPoint => ({
  u: point.u + by.u,
  v: point.v + by.v,
});

function discoveryTexture(kind: WorldFeature['kind'], found: boolean): string {
  switch (kind) {
    case 'chest':
      return found ? WILD_TEXTURES.chestOpen : WILD_TEXTURES.chest;
    case 'crate':
      return WILD_TEXTURES.crate;
    case 'rockfall':
      return WILD_TEXTURES.rockfall;
    case 'lookout':
      return found ? WILD_TEXTURES.cairnFlag : WILD_TEXTURES.cairn;
    default:
      return WILD_TEXTURES.bench;
  }
}
