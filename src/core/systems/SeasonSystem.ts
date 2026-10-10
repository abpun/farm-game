import type { SeasonDef, SeasonsConfig } from '../entities/types';
import type { GameBus } from '../events/EventBus';
import type { TimeSystem } from './TimeSystem';

export class SeasonSystem {
  private readonly seasonLengths: number[];
  private readonly cycleLengthSec: number;
  private readonly offsetSec: number;
  private lastIndex: number;
  private lastDay: number;

  constructor(
    private readonly time: TimeSystem,
    private readonly config: SeasonsConfig,
    private readonly dayLengthSec: number,
    private readonly bus: GameBus,
  ) {
    if (config.seasons.length === 0) throw new Error('At least one season is required');
    const start = config.seasons.findIndex((season) => season.id === config.startSeason);
    if (start < 0) throw new Error(`Unknown start season: ${config.startSeason}`);
    this.seasonLengths = config.seasons.map((s) => (s.days ?? config.daysPerSeason) * dayLengthSec);
    this.cycleLengthSec = this.seasonLengths.reduce((a, b) => a + b, 0);
    let offset = 0;
    for (let i = 0; i < start; i++) offset += this.seasonLengths[i]!;
    this.offsetSec = offset;
    this.lastIndex = this.index();
    this.lastDay = this.absoluteDay();
  }

  all(): readonly SeasonDef[] {
    return this.config.seasons;
  }

  current(): SeasonDef {
    return this.config.seasons[this.index()] as SeasonDef;
  }

  /** 1-based day within the current season. */
  dayOfSeason(): number {
    return Math.floor(this.elapsedInSeason() / this.dayLengthSec) + 1;
  }

  year(): number {
    const elapsed = this.time.now() + this.offsetSec;
    return Math.floor(elapsed / this.cycleLengthSec) + 1;
  }

  secondsToNextSeason(): number {
    return this.currentSeasonLength() - this.elapsedInSeason();
  }

  daysInCurrentSeason(): number {
    return this.config.seasons[this.index()]?.days ?? this.config.daysPerSeason;
  }

  checkForChange(): void {
    const day = this.absoluteDay();
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.bus.emit('DayChanged', { day: this.dayOfSeason() });
    }
    const index = this.index();
    if (index === this.lastIndex) return;
    this.lastIndex = index;
    this.bus.emit('SeasonChanged', { seasonId: this.current().id });
  }

  private absoluteDay(): number {
    return Math.floor(this.time.now() / this.dayLengthSec);
  }

  private index(): number {
    const elapsed =
      (((this.time.now() + this.offsetSec) % this.cycleLengthSec) + this.cycleLengthSec) %
      this.cycleLengthSec;
    let acc = 0;
    for (let i = 0; i < this.seasonLengths.length; i++) {
      acc += this.seasonLengths[i]!;
      if (elapsed < acc) return i;
    }
    return this.seasonLengths.length - 1;
  }

  private elapsedInSeason(): number {
    const elapsed =
      (((this.time.now() + this.offsetSec) % this.cycleLengthSec) + this.cycleLengthSec) %
      this.cycleLengthSec;
    let acc = 0;
    for (let i = 0; i < this.seasonLengths.length; i++) {
      const len = this.seasonLengths[i]!;
      if (elapsed < acc + len) return elapsed - acc;
      acc += len;
    }
    return 0;
  }

  private currentSeasonLength(): number {
    return this.seasonLengths[this.index()]!;
  }
}
