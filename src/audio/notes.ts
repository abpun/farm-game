import type { Pitch } from './types';

const A4_MIDI = 69;
const A4_HZ = 440;
const SEMITONES = 12;
const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL: Record<string, number> = { '': 0, '#': 1, b: -1 };

const CHORD_QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
};

export const midiToHz = (midi: number): number => A4_HZ * 2 ** ((midi - A4_MIDI) / SEMITONES);

/** MIDI number for a note name such as "C4", "Bb3" or "F#5". */
export function noteToMidi(note: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(note.trim());
  if (!match) throw new Error(`Bad note: ${note}`);
  const [, letter = 'C', accidental = '', octave = '4'] = match;
  return (
    (Number(octave) + 1) * SEMITONES + (PITCH_CLASS[letter] ?? 0) + (ACCIDENTAL[accidental] ?? 0)
  );
}

export const pitchToHz = (pitch: Pitch): number =>
  typeof pitch === 'number' ? pitch : midiToHz(noteToMidi(pitch));

export interface Chord {
  /** Pitch class of the root, 0 = C. */
  root: number;
  intervals: number[];
}

export function parseChord(symbol: string): Chord {
  const match = /^([A-G])([#b]?)(.*)$/.exec(symbol.trim());
  const intervals = match ? CHORD_QUALITIES[match[3] ?? ''] : undefined;
  if (!match || !intervals) throw new Error(`Bad chord: ${symbol}`);
  const [, letter = 'C', accidental = ''] = match;
  return { root: (PITCH_CLASS[letter] ?? 0) + (ACCIDENTAL[accidental] ?? 0), intervals };
}

/** Semitones above the root for a degree character: 1 3 5 7, 8 = octave, 9 = ninth. */
export function degreeInterval(chord: Chord, degree: string): number | null {
  const [root = 0, third = 4, fifth = 7, seventh] = chord.intervals;
  switch (degree) {
    case '1':
      return root;
    case '3':
      return third;
    case '5':
      return fifth;
    case '7':
      return seventh ?? SEMITONES;
    case '8':
      return SEMITONES;
    case '9':
      return SEMITONES + 2;
    default:
      return null;
  }
}
