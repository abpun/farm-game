import type { MusicData } from './types';

export interface MusicContext {
  seasonId: string;
  fishing: boolean;
  /** A place with its own theme (e.g. the mine) overrides everything else. */
  place?: string | null;
}

/** Which track fits the moment: fishing has its own theme, some seasons have theirs. */
export function pickTrack(data: MusicData, context: MusicContext): string {
  const placeTrack = context.place ? data.placeTracks[context.place] : undefined;
  if (placeTrack) return placeTrack;
  if (context.fishing) return data.fishingTrack;
  return data.seasonTracks[context.seasonId] ?? data.defaultTrack;
}
