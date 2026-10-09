export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';
export type FilterKind = 'lowpass' | 'highpass' | 'bandpass';
/** Pitch as Hz or a note name like "A4". */
export type Pitch = number | string;

// One synthesized voice: an oscillator (or noise) with a gain envelope and optional filter.
export interface ToneLayer {
  wave: Wave;
  freq?: Pitch;
  /** Pitch at the end of the layer, for slides and chirps. */
  to?: Pitch;
  /** Seconds after the cue starts. */
  delay?: number;
  dur: number;
  attack?: number;
  /** When set the note sustains, then fades over this many seconds; otherwise it decays. */
  release?: number;
  gain: number;
  filter?: { type: FilterKind; freq: number; to?: number; q?: number };
  vibrato?: { rate: number; depth: number };
}

export type SoundChannel = 'sfx' | 'ambient';

export interface CueDef {
  channel?: SoundChannel;
  gain?: number;
  /** Minimum gap between two starts of this cue. */
  cooldownMs?: number;
  maxVoices?: number;
  /** Random playback-rate spread (0.05 = ±5%) so repeats don't sound identical. */
  pitchJitter?: number;
  /** Music drops to this fraction while the cue plays (jingles). */
  duck?: number;
  /** Optional recorded file that replaces the synthesized version when it loads. */
  file?: string;
  layers: ToneLayer[];
}

export interface SoundsData {
  maxVoices: number;
  cues: Record<string, CueDef>;
}

export type PartStyle = 'bass' | 'arp' | 'melody' | 'drums';

export interface PartDef {
  style: PartStyle;
  wave: Wave;
  gain: number;
  octave?: number;
  /** bass/arp: one char per step, digits are chord degrees (1 3 5 7 8 9), '-' holds, '.' rests. */
  pattern?: string;
  /** melody: space-separated notes per step, '-' holds, '.' rests; repeats to fill the loop. */
  notes?: string;
  /** Seconds a plucked note rings; omit for held notes. */
  decay?: number;
  attack?: number;
  filter?: number;
  vibrato?: { rate: number; depth: number };
}

export interface TrackDef {
  id: string;
  bpm: number;
  stepsPerBeat: number;
  beatsPerBar: number;
  gain: number;
  /** One chord per bar, e.g. "F", "Dm", "Bb", "C7". */
  chords: string[];
  parts: PartDef[];
  file?: string;
}

export interface MusicData {
  defaultTrack: string;
  fishingTrack: string;
  seasonTracks: Record<string, string>;
  fadeSec: number;
  tracks: TrackDef[];
}

export interface AmbientSourceDef {
  id: string;
  cues: string[];
  intervalSec: [number, number];
  /** Only in these seasons (all when omitted). */
  seasons?: string[];
  /** Only while this farm feature exists, e.g. "animal:chicken". */
  requires?: string;
}

export interface AmbienceData {
  /** Cue looped quietly underneath everything (the sea), and its loop length. */
  bed: string;
  bedLoopSec: number;
  maxStepSec: number;
  sources: AmbientSourceDef[];
}
