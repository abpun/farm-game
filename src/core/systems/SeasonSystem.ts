import type { SeasonDef, SeasonsConfig } from '../entities/types';
import type { GameBus } from '../events/EventBus';
import type { TimeSystem } from './TimeSystem';

// Calendar derived from game time: fixed-length days grouped into repeating seasons.
export class SeasonSystem {
  private readonly seasonLengthSec: number;
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
    this.seasonLengthSec = config.daysPerSeason * dayLengthSec;
    this.offsetSec = start * this.seasonLengthSec;
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
    const seasons = Math.floor((this.time.now() + this.offsetSec) / this.seasonLengthSec);
    return Math.floor(seasons / this.config.seasons.length) + 1;
  }

  secondsToNextSeason(): number {
    return this.seasonLengthSec - this.elapsedInSeason();
  }

  /** Emits DayChanged and SeasonChanged once each when the calendar moves on. */
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
    const seasons = Math.floor((this.time.now() + this.offsetSec) / this.seasonLengthSec);
    return seasons % this.config.seasons.length;
  }

  private elapsedInSeason(): number {
    return (this.time.now() + this.offsetSec) % this.seasonLengthSec;
  }
}
