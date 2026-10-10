import type { GameSession } from '@core/GameSession';

export interface CueRequest {
  cue: string;
  /** Seconds to wait before starting, to sequence two sounds from one event. */
  delay?: number;
}

export type PlayCue = (request: CueRequest) => void;

const RARE = new Set(['rare', 'legendary']);
const DISCOVERY_CUES: Record<string, string> = {
  chest: 'chest-open',
  viewpoint: 'viewpoint',
  obstacle: 'rockfall',
};
const FOLLOW_UP_SEC = 0.3;
const PLACE_CUES: Record<string, string> = {
  plot: 'unlock-plot',
  building: 'build',
};

export const animalCue = (animalId: string) => `animal-${animalId}`;

// Gameplay events → named sound cues. Core only emits these after an action succeeds,
// so failed actions can never trigger a success sound. Returns an unsubscribe function.
export function bindGameSounds(session: GameSession, play: PlayCue): () => void {
  const { bus, content, world } = session;
  const say = (cue: string, delay?: number) => play({ cue, delay });
  const animalAt = (objectId: number) => {
    const object = world.get(objectId);
    return object ? content.animalFor(object.itemId) : undefined;
  };

  const offs = [
    bus.on('CropPlanted', () => say('plant')),
    bus.on('CropWatered', () => say('water')),
    bus.on('CropHarvested', ({ cropId }) =>
      say(content.crops.get(cropId).category === 'fruit' ? 'fruit' : 'harvest'),
    ),
    bus.on('MoneyChanged', ({ delta }) => delta > 0 && say('coin')),
    bus.on('ItemBought', () => say('purchase')),
    bus.on('ObjectPlaced', ({ object }) =>
      say(PLACE_CUES[content.catalog.get(object.itemId).kind] ?? 'place'),
    ),
    bus.on('ObjectRemoved', () => say('remove')),
    bus.on('ObjectMoved', ({ object }) =>
      say(PLACE_CUES[content.catalog.get(object.itemId).kind] ?? 'place'),
    ),
    bus.on('LandExpanded', () => say('unlock')),
    bus.on('StorageUpgraded', () => say('upgrade')),
    bus.on('BuildingCompleted', () => say('building-complete')),
    bus.on('BuildingUpgraded', () => say('upgrade')),
    bus.on('ProductionStarted', () => say('production-start')),
    bus.on('ProductionReady', () => say('production-ready')),
    bus.on('ProductionCollected', () => say('collect')),
    bus.on('AnimalBought', ({ animalId }) => say(animalCue(animalId))),
    bus.on('AnimalsFed', ({ objectId }) => {
      say('feed');
      const animal = animalAt(objectId);
      if (animal) say(animalCue(animal.id), FOLLOW_UP_SEC);
    }),
    bus.on('AnimalProductsCollected', () => say('collect')),
    bus.on('FishingCast', () => {
      say('cast');
      say('splash', FOLLOW_UP_SEC);
    }),
    bus.on('FishBite', () => say('bite')),
    bus.on('FishCaught', ({ fishId, firstCatch }) => {
      say('catch');
      const rarity = content.fish.get(fishId).rarity;
      if (rarity === 'legendary') say('legendary-fish', FOLLOW_UP_SEC);
      else if (RARE.has(rarity)) say('rare-fish', FOLLOW_UP_SEC);
      else if (firstCatch) say('discovery', FOLLOW_UP_SEC);
    }),
    bus.on('FishEscaped', () => say('fish-escape')),
    bus.on('RodUpgraded', () => say('upgrade')),
    bus.on('OrderCompleted', () => say('delivery')),
    bus.on('OrderExpired', () => say('order-expired')),
    bus.on('AchievementCompleted', () => say('achievement')),
    bus.on('AchievementClaimed', () => say('reward')),
    bus.on('XpGained', () => say('xp')),
    bus.on('DepositStruck', () => say('mine-hit')),
    bus.on('DepositMined', () => {
      say('mine-hit');
      say('mine-break', FOLLOW_UP_SEC / 3);
    }),
    bus.on('PickaxeUpgraded', () => say('upgrade')),
    bus.on('BoatUpgraded', () => say('boat-horn')),
    bus.on('DiscoveryFound', ({ kind }) => say(DISCOVERY_CUES[kind] ?? 'reward')),
    bus.on('LevelUp', () => say('level-up')),
    bus.on('DayChanged', () => say('day')),
    bus.on('SeasonChanged', () => say('season')),
  ];
  return () => offs.forEach((off) => off());
}
