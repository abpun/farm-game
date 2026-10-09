import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { hex } from '../art/paint';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import type { FishingSpots } from '../scenery/FishingSpots';
import { getUiBus } from '../session';
import type { WorldView } from '../world/WorldView';
import { FX } from './fxPalette';
import { ParticlePool, type BurstSpec } from './ParticlePool';
import { effectsEnabled, reducedMotion, shakeEnabled } from './prefs';
import { Ripples } from './Ripples';

const MAX_PARTICLES = 160;
const MAX_RIPPLES = 10;
const FX_DEPTH = 15000;
const DROP_HEIGHT = 46;
const WAIT_RIPPLE_MS = 1700;
const SMOKE_MS = 1500;
const BOUNCE = { squash: 0.9, ms: 110 } as const;
const LEGENDARY_SHAKE = { ms: 160, intensity: 0.004 } as const;

const RARE_FISH = new Set(['rare', 'legendary']);

// Short, capped feedback on the island for things that just happened: soil puffs,
// droplets, harvest pops, building dust, fishing splashes and working-building smoke.
export class WorldFx {
  private readonly particles: ParticlePool;
  private readonly ripples: Ripples;
  private sinceRipple = 0;
  private sinceSmoke = 0;
  /** FishCaught fires after the cast is cleared, so remember where the line went in. */
  private castSpot: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
    private readonly world: WorldView,
    private readonly spots: FishingSpots,
    private readonly landmarkAt: (featureId: string) => { x: number; y: number } | null,
  ) {
    this.particles = new ParticlePool(scene, MAX_PARTICLES, PIXEL_SCALE, FX_DEPTH);
    this.ripples = new Ripples(scene, MAX_RIPPLES, PIXEL_SCALE);
    const { bus } = session;
    const offs = [
      bus.on('CropPlanted', ({ plotId }) =>
        this.atPlot(plotId, (x, y) => this.burst(x, y, FX.soil)),
      ),
      bus.on('CropWatered', ({ plotId }) => this.atPlot(plotId, (x, y) => this.water(x, y))),
      bus.on('CropHarvested', ({ plotId, cropId }) =>
        this.atPlot(plotId, (x, y) => this.harvest(x, y, cropId)),
      ),
      bus.on('ObjectPlaced', ({ object }) =>
        this.atObject(object.id, (x, y) => this.burst(x, y, FX.dust)),
      ),
      bus.on('BuildingCompleted', ({ objectId }) => this.celebrateBuilding(objectId)),
      bus.on('BuildingUpgraded', ({ objectId }) => this.celebrateBuilding(objectId)),
      bus.on('AnimalProductsCollected', ({ objectId, itemId }) => this.collect(objectId, itemId)),
      bus.on('ProductionCollected', ({ objectId, items }) => {
        const first = Object.keys(items)[0];
        if (first) this.collect(objectId, first);
      }),
      bus.on('FishingCast', ({ spotId }) => {
        this.castSpot = spotId;
        this.splash(spotId, FX.castSplash, 2);
      }),
      bus.on('FishBite', ({ spotId }) => this.splash(spotId, FX.biteSplash, 3)),
      bus.on('FishCaught', ({ fishId }) => this.caught(fishId)),
      bus.on('DiscoveryFound', ({ id, kind }) => {
        const point = this.landmarkAt(id);
        if (!point) return;
        this.burst(point.x, point.y - this.grid.tileH / 2, FX.sparkle);
        if (kind === 'obstacle') this.burst(point.x, point.y, FX.dust);
      }),
    ];
    scene.events.once('shutdown', () => offs.forEach((off) => off()));
  }

  update(deltaMs: number): void {
    this.sinceRipple += deltaMs;
    this.sinceSmoke += deltaMs;
    if (this.sinceRipple >= WAIT_RIPPLE_MS) {
      this.sinceRipple = 0;
      const cast = this.session.fishing.cast();
      if (cast && this.session.fishing.phase() === 'waiting') this.ripple(cast.spotId, 1);
    }
    if (this.sinceSmoke >= SMOKE_MS) {
      this.sinceSmoke = 0;
      this.smoke();
    }
  }

  private get on(): boolean {
    return effectsEnabled(this.scene) && !reducedMotion(this.scene);
  }

  private burst(x: number, y: number, spec: BurstSpec): void {
    if (this.on) this.particles.burst(x, y, spec);
  }

  private atPlot(plotId: number, run: (x: number, y: number) => void): void {
    const view = this.world.plotView(plotId);
    if (!view) return;
    const { x, y } = view.center();
    run(x, y);
  }

  private atObject(objectId: number, run: (x: number, y: number) => void): void {
    const object = this.session.world.get(objectId);
    if (!object) return;
    const { footprint } = this.session.catalog.get(object.itemId);
    const { x, y } = this.grid.toScreen(
      object.col + footprint.cols / 2,
      object.row + footprint.rows / 2,
    );
    run(x, y);
  }

  private water(x: number, y: number): void {
    this.burst(x, y - DROP_HEIGHT, FX.droplets);
    this.scene.time.delayedCall(FX.dropFallMs, () => this.burst(x, y, FX.dropSplash));
  }

  private harvest(x: number, y: number, cropId: string): void {
    const { visual } = this.session.crops.get(cropId);
    this.burst(x, y, { ...FX.harvest, colors: [hex(visual.produce), hex(visual.leaf)] });
    this.flyToBarn(x, y, cropId);
  }

  private collect(objectId: number, itemId: string): void {
    this.atObject(objectId, (x, y) => {
      this.burst(x, y, FX.sparkle);
      this.flyToBarn(x, y, itemId);
    });
  }

  private flyToBarn(worldX: number, worldY: number, itemId: string): void {
    if (!this.on) return;
    const view = this.scene.cameras.main.worldView;
    const zoom = this.scene.cameras.main.zoom;
    const x = (worldX - view.x) * zoom;
    const y = (worldY - view.y) * zoom;
    getUiBus(this.scene).emit('Collected', { x, y, itemId });
  }

  private celebrateBuilding(objectId: number): void {
    this.atObject(objectId, (x, y) => {
      this.burst(x, y, FX.dust);
      this.burst(x, y - this.grid.tileH, FX.sparkle);
    });
    const sprite = this.world.sprite(objectId);
    if (!sprite || reducedMotion(this.scene)) return;
    const scaleY = sprite.scaleY;
    this.scene.tweens.add({
      targets: sprite,
      scaleY: scaleY * BOUNCE.squash,
      duration: BOUNCE.ms,
      yoyo: true,
      onComplete: () => sprite.setScale(sprite.scaleX, scaleY),
    });
  }

  private splash(spotId: string, spec: BurstSpec, rings: number): void {
    const point = this.spots.bobberPoint(spotId);
    if (!point) return;
    this.burst(point.x, point.y, spec);
    this.ripple(spotId, rings);
  }

  private ripple(spotId: string, rings: number, color: number = FX.rippleColor): void {
    const point = this.spots.bobberPoint(spotId);
    if (!point || !this.on) return;
    this.ripples.spawn(point.x, point.y, point.depth, { ...FX.ripple, rings, color });
  }

  private caught(fishId: string): void {
    const spotId = this.castSpot;
    if (!spotId) return;
    const rarity = this.session.content.fish.get(fishId).rarity;
    this.splash(spotId, FX.catchSplash, 2);
    const point = this.spots.bobberPoint(spotId);
    if (point) this.flyToBarn(point.x, point.y, fishId);
    if (!RARE_FISH.has(rarity) || !point) return;
    const legendary = rarity === 'legendary';
    this.burst(point.x, point.y - this.grid.tileH / 2, legendary ? FX.legendary : FX.rare);
    this.ripple(spotId, legendary ? 3 : 2, FX.rareRippleColor);
    if (legendary && shakeEnabled(this.scene)) {
      this.scene.cameras.main.shake(LEGENDARY_SHAKE.ms, LEGENDARY_SHAKE.intensity);
    }
  }

  private smoke(): void {
    if (!this.on) return;
    const { buildings, time } = this.session;
    for (const id of buildings.ofRole('production')) {
      if (!buildings.isOperational(id)) continue;
      const working = buildings.record(id).queue.some((job) => job.endsAt > time.now());
      const sprite = this.world.sprite(id);
      if (!working || !sprite) continue;
      const top = sprite.getTopCenter();
      this.particles.burst(top.x ?? 0, (top.y ?? 0) + sprite.displayHeight * 0.2, FX.smoke);
    }
  }
}
