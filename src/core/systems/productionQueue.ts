import type { RecipeDef } from '../entities/content';
import type { BuildingState, ProductionJob } from '../entities/types';

// Jobs run one after another; each job's timing is fixed when it is queued.

export function enqueue(
  building: BuildingState,
  recipe: RecipeDef,
  now: number,
  speed: number,
): ProductionJob {
  const last = building.queue[building.queue.length - 1];
  const startsAt = Math.max(now, last?.endsAt ?? now);
  const job = { recipeId: recipe.id, startsAt, endsAt: startsAt + recipe.durationSec / speed };
  building.queue.push(job);
  return job;
}

export const finishedJobs = (building: BuildingState, now: number): ProductionJob[] =>
  building.queue.filter((job) => job.endsAt <= now);

/** 0..1 progress of a job at `now`. */
export function jobProgress(job: ProductionJob, now: number): number {
  const span = job.endsAt - job.startsAt;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (now - job.startsAt) / span));
}
