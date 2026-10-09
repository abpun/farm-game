import { composeTrack } from './compose';
import { bakeCue, bakeLoop, loadFile } from './synth/bake';
import type { AmbienceData, CueDef, MusicData, SoundsData } from './types';

const SFX_RATE = 32000;
const LOOP_RATE = 22050;
const DEFAULT_PEAK = 0.4;

// Every sound the game can play, baked once at boot (or loaded from a file when one
// is configured) and reused for every playback. Missing entries simply stay silent.
export class SoundBank {
  private readonly cues = new Map<string, AudioBuffer>();
  private readonly loops = new Map<string, AudioBuffer>();
  private readonly listeners: Array<(id: string) => void> = [];
  private cancelled = false;

  constructor(
    readonly sounds: SoundsData,
    readonly music: MusicData,
    readonly ambience: AmbienceData,
  ) {}

  cue(id: string): AudioBuffer | undefined {
    return this.cues.get(id);
  }

  cueDef(id: string): CueDef | undefined {
    return this.sounds.cues[id];
  }

  loop(id: string): AudioBuffer | undefined {
    return this.loops.get(id);
  }

  /** Called with each loop id (track or ambience bed) as it becomes playable. */
  onLoopReady(listener: (id: string) => void): void {
    this.listeners.push(listener);
  }

  /** Bakes short cues first so the UI has sound almost at once, then the loops. */
  async bakeAll(firstTrack: string): Promise<void> {
    for (const [id, def] of Object.entries(this.sounds.cues)) {
      if (this.cancelled) return;
      const buffer = await this.safely(id, async () => {
        const file = def.file ? await loadFile(def.file) : null;
        return file ?? bakeCue(def.layers, SFX_RATE, def.gain ?? DEFAULT_PEAK);
      });
      if (buffer) this.cues.set(id, buffer);
    }
    const first = (id: string) => (id === firstTrack ? 0 : 1);
    const tracks = [...this.music.tracks].sort((a, b) => first(a.id) - first(b.id));
    for (const track of tracks) {
      await this.addLoop(track.id, async () => {
        const file = track.file ? await loadFile(track.file) : null;
        if (file) return file;
        const { layers, loopSec } = composeTrack(track);
        return bakeLoop(layers, loopSec, LOOP_RATE, track.gain);
      });
    }
    const bed = this.sounds.cues[this.ambience.bed];
    if (bed) {
      await this.addLoop(this.ambience.bed, () =>
        bakeLoop(bed.layers, this.ambience.bedLoopSec, LOOP_RATE, bed.gain ?? DEFAULT_PEAK),
      );
    }
  }

  cancel(): void {
    this.cancelled = true;
  }

  private async addLoop(id: string, make: () => Promise<AudioBuffer>): Promise<void> {
    if (this.cancelled) return;
    const buffer = await this.safely(id, make);
    if (!buffer) return;
    this.loops.set(id, buffer);
    this.listeners.forEach((listener) => listener(id));
  }

  private async safely(id: string, make: () => Promise<AudioBuffer>) {
    try {
      return await make();
    } catch (error) {
      console.warn(`Sound "${id}" could not be prepared`, error);
      return null;
    }
  }
}
