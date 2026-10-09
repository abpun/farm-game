import type { FarmState } from '../entities/types';

export class TimeSystem {
  constructor(private readonly state: FarmState) {}

  update(dtSec: number): void {
    this.state.time += dtSec;
  }

  now(): number {
    return this.state.time;
  }
}
