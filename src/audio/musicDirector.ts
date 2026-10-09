import type { MusicData } from './types';

export interface MusicContext {
  seasonId: string;
  fishing: boolean;
}

/** Which track fits the moment: fishing has its own theme, some seasons have theirs. */
export function pickTrack(data: MusicData, context: MusicContext): string {
  if (context.fishing) return data.fishingTrack;
  return data.seasonTracks[context.seasonId] ?? data.defaultTrack;
}
