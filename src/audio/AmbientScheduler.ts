import type { AmbienceData, AmbientSourceDef } from './types';

export interface AmbientContext {
  seasonId: string;
  /** Things on the farm that make sounds, e.g. "animal:cow". */
  features: ReadonlySet<string>;
}

interface SourceTimer {
  def: AmbientSourceDef;
  wait: number;
}

const RETRY_SEC: [number, number] = [1, 3];

// Picks occasional environmental one-shots: each source waits a random interval,
// only counts down while it applies, and at most one cue starts per update.
export class AmbientScheduler {
  private readonly timers: SourceTimer[];

  constructor(
    private readonly data: AmbienceData,
    private readonly random: () => number,
  ) {
    this.timers = data.sources.map((def) => ({ def, wait: this.interval(def.intervalSec) }));
  }

  update(dtSec: number, context: AmbientContext): string | null {
    const step = Math.min(Math.max(0, dtSec), this.data.maxStepSec);
    let picked: string | null = null;
    for (const timer of this.timers) {
      if (!this.applies(timer.def, context)) {
        timer.wait = Math.max(timer.wait, this.interval(timer.def.intervalSec) / 2);
        continue;
      }
      timer.wait -= step;
      if (timer.wait > 0) continue;
      if (picked) {
        timer.wait = this.interval(RETRY_SEC);
        continue;
      }
      picked = this.pickCue(timer.def);
      timer.wait = this.interval(timer.def.intervalSec);
    }
    return picked;
  }

  private applies(def: AmbientSourceDef, context: AmbientContext): boolean {
    if (def.seasons && !def.seasons.includes(context.seasonId)) return false;
    return !def.requires || context.features.has(def.requires);
  }

  private pickCue(def: AmbientSourceDef): string | null {
    return def.cues[Math.floor(this.random() * def.cues.length)] ?? def.cues[0] ?? null;
  }

  private interval([min, max]: [number, number]): number {
    return min + this.random() * (max - min);
  }
}
