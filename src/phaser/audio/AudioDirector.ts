import type * as Phaser from 'phaser';
import ambienceJson from '@data/ambience.json';
import musicJson from '@data/music.json';
import { AmbientScheduler } from '@audio/AmbientScheduler';
import { bindGameSounds } from '@audio/gameSounds';
import { pickTrack } from '@audio/musicDirector';
import type { AmbienceData, MusicData } from '@audio/types';
import type { GameSession } from '@core/GameSession';
import { getAudio } from '../session';

const MS_PER_SEC = 1000;
const FEATURE_REFRESH_SEC = 2;

// Connects the running game to the audio engine: gameplay cues, the music that fits
// the moment, and occasional ambience for what is actually on the island.
export class AudioDirector {
  private readonly ambience: AmbientScheduler;
  private features = new Set<string>();
  private sinceFeatures = FEATURE_REFRESH_SEC;
  private fishing = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
  ) {
    this.ambience = new AmbientScheduler(ambienceJson as AmbienceData, Math.random);
    const audio = getAudio(scene);
    const unbind = audio
      ? bindGameSounds(session, ({ cue, delay }) => audio.play(cue, { delay }))
      : () => undefined;
    const offSeason = session.bus.on('SeasonChanged', () => this.chooseMusic());
    scene.events.once('shutdown', () => {
      unbind();
      offSeason();
    });
    this.chooseMusic();
  }

  setFishing(fishing: boolean): void {
    if (this.fishing === fishing) return;
    this.fishing = fishing;
    this.chooseMusic();
  }

  update(deltaMs: number): void {
    const audio = getAudio(this.scene);
    if (!audio) return;
    const dt = deltaMs / MS_PER_SEC;
    this.sinceFeatures += dt;
    if (this.sinceFeatures >= FEATURE_REFRESH_SEC) {
      this.sinceFeatures = 0;
      this.features = this.farmFeatures();
    }
    const seasonId = this.session.seasons.current().id;
    const cue = this.ambience.update(dt, { seasonId, features: this.features });
    if (cue) audio.play(cue, { channel: 'ambient' });
  }

  private chooseMusic(): void {
    const seasonId = this.session.seasons.current().id;
    getAudio(this.scene)?.setMusic(
      pickTrack(musicJson as MusicData, { seasonId, fishing: this.fishing }),
    );
  }

  private farmFeatures(): Set<string> {
    const features = new Set<string>();
    for (const building of Object.values(this.session.state.buildings)) {
      for (const animal of building.animals) features.add(`animal:${animal.animalId}`);
    }
    return features;
  }
}
