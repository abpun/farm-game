import { degreeInterval, midiToHz, noteToMidi, parseChord } from './notes';
import type { PartDef, ToneLayer, TrackDef } from './types';

const SEC_PER_MIN = 60;
const SEMITONES = 12;
const HOLD = '-';
const REST = '.';
const LEGATO = 0.92;
const HELD_RELEASE = 0.08;
const DEFAULT_ATTACK = 0.008;

// Drum hits are fixed little recipes; patterns only say when they land.
const DRUMS: Record<string, Omit<ToneLayer, 'delay'>> = {
  x: { wave: 'noise', dur: 0.035, gain: 0.5, filter: { type: 'highpass', freq: 6500 } },
  s: { wave: 'noise', dur: 0.07, gain: 0.45, filter: { type: 'bandpass', freq: 4200, q: 1.2 } },
  o: { wave: 'sine', freq: 120, to: 48, dur: 0.16, gain: 1 },
};

export interface ComposedTrack {
  loopSec: number;
  layers: ToneLayer[];
}

interface NoteRun {
  step: number;
  length: number;
  midi: number;
}

/** Turns a track definition into timed tone layers covering exactly one loop. */
export function composeTrack(track: TrackDef): ComposedTrack {
  const stepSec = SEC_PER_MIN / track.bpm / track.stepsPerBeat;
  const stepsPerBar = track.stepsPerBeat * track.beatsPerBar;
  const totalSteps = stepsPerBar * track.chords.length;
  const layers: ToneLayer[] = [];
  for (const part of track.parts) {
    if (part.style === 'drums') {
      layers.push(...drumLayers(part, totalSteps, stepSec));
      continue;
    }
    const runs =
      part.style === 'melody'
        ? melodyRuns(part, totalSteps)
        : chordRuns(part, track.chords, stepsPerBar);
    layers.push(...runs.map((run) => noteLayer(part, run, stepSec, track.gain)));
  }
  return { loopSec: totalSteps * stepSec, layers };
}

function noteLayer(part: PartDef, run: NoteRun, stepSec: number, trackGain: number): ToneLayer {
  const held = run.length * stepSec;
  const layer: ToneLayer = {
    wave: part.wave,
    freq: midiToHz(run.midi),
    delay: run.step * stepSec,
    dur: part.decay ? Math.max(part.decay, held) : held * LEGATO,
    attack: part.attack ?? DEFAULT_ATTACK,
    gain: part.gain * trackGain,
  };
  if (!part.decay) layer.release = Math.min(HELD_RELEASE, layer.dur / 2);
  if (part.filter) layer.filter = { type: 'lowpass', freq: part.filter };
  if (part.vibrato) layer.vibrato = part.vibrato;
  return layer;
}

// Reads a token stream where '-' extends the previous note and '.' is silence.
function collectRuns(tokens: string[], toMidi: (token: string, step: number) => number | null) {
  const runs: NoteRun[] = [];
  let current: NoteRun | null = null;
  tokens.forEach((token, step) => {
    if (token === HOLD && current) {
      current.length += 1;
      return;
    }
    const midi = token === REST || token === HOLD ? null : toMidi(token, step);
    current = midi === null ? null : { step, length: 1, midi };
    if (current) runs.push(current);
  });
  return runs;
}

function chordRuns(part: PartDef, chords: string[], stepsPerBar: number): NoteRun[] {
  const pattern = [...(part.pattern ?? '1')];
  const base = ((part.octave ?? 3) + 1) * SEMITONES;
  const tokens = Array.from(
    { length: stepsPerBar * chords.length },
    (_, i) => pattern[i % pattern.length] ?? REST,
  );
  const parsed = chords.map(parseChord);
  return collectRuns(tokens, (token, step) => {
    const chord = parsed[Math.floor(step / stepsPerBar)];
    const interval = chord ? degreeInterval(chord, token) : null;
    return chord && interval !== null ? base + chord.root + interval : null;
  });
}

function melodyRuns(part: PartDef, totalSteps: number): NoteRun[] {
  const notes = (part.notes ?? '').split(/\s+/).filter(Boolean);
  if (notes.length === 0) return [];
  const tokens = Array.from({ length: totalSteps }, (_, i) => notes[i % notes.length] ?? REST);
  return collectRuns(tokens, (token) => noteToMidi(token));
}

function drumLayers(part: PartDef, totalSteps: number, stepSec: number): ToneLayer[] {
  const pattern = [...(part.pattern ?? '')];
  if (pattern.length === 0) return [];
  const layers: ToneLayer[] = [];
  for (let step = 0; step < totalSteps; step++) {
    const hit = DRUMS[pattern[step % pattern.length] ?? REST];
    if (hit) layers.push({ ...hit, delay: step * stepSec, gain: hit.gain * part.gain });
  }
  return layers;
}
