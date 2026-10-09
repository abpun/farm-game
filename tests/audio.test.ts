import { describe, expect, it } from 'vitest';
import ambienceJson from '@data/ambience.json';
import musicJson from '@data/music.json';
import soundsJson from '@data/sounds.json';
import { AmbientScheduler } from '@audio/AmbientScheduler';
import { composeTrack } from '@audio/compose';
import { CueLimiter } from '@audio/CueLimiter';
import { bindGameSounds, type CueRequest } from '@audio/gameSounds';
import { pickTrack } from '@audio/musicDirector';
import { noteToMidi, parseChord, pitchToHz } from '@audio/notes';
import type { AmbienceData, MusicData, SoundsData } from '@audio/types';
import { buildReady, newSession, richSession } from './helpers';

const sounds = soundsJson as SoundsData;
const music = musicJson as MusicData;
const ambience = ambienceJson as AmbienceData;

const recorder = () => {
  const played: string[] = [];
  return { played, play: (request: CueRequest) => played.push(request.cue) };
};

describe('audio data', () => {
  it('parses notes and chords', () => {
    expect(pitchToHz('A4')).toBeCloseTo(440);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(parseChord('Gm')).toEqual({ root: 7, intervals: [0, 3, 7] });
    expect(() => parseChord('H7')).toThrow();
  });

  it('defines valid layers for every cue', () => {
    for (const [id, cue] of Object.entries(sounds.cues)) {
      expect(cue.layers.length, id).toBeGreaterThan(0);
      for (const layer of cue.layers) {
        expect(layer.dur, id).toBeGreaterThan(0);
        if (layer.freq !== undefined) expect(pitchToHz(layer.freq), id).toBeGreaterThan(0);
        if (layer.to !== undefined) expect(pitchToHz(layer.to), id).toBeGreaterThan(0);
      }
    }
  });

  it('composes each track into whole-bar loops with every melody note in range', () => {
    for (const track of music.tracks) {
      const stepsPerBar = track.stepsPerBeat * track.beatsPerBar;
      for (const part of track.parts.filter((p) => p.notes)) {
        const tokens = part.notes!.split(/\s+/).filter(Boolean);
        expect(tokens.length % stepsPerBar, track.id).toBe(0);
      }
      const { loopSec, layers } = composeTrack(track);
      const barSec = (60 / track.bpm) * track.beatsPerBar;
      expect(loopSec).toBeCloseTo(barSec * track.chords.length);
      expect(layers.length).toBeGreaterThan(track.chords.length);
      for (const layer of layers) {
        expect(layer.delay ?? 0).toBeLessThan(loopSec);
        if (layer.freq !== undefined) expect(pitchToHz(layer.freq)).toBeLessThan(5000);
      }
    }
  });

  it('holds notes across "-" and leaves "." silent', () => {
    const { layers } = composeTrack({
      id: 't',
      bpm: 60,
      stepsPerBeat: 1,
      beatsPerBar: 4,
      gain: 1,
      chords: ['C'],
      parts: [{ style: 'melody', wave: 'sine', gain: 1, notes: 'C4 - . E4' }],
    });
    expect(layers.map((l) => [l.delay, Math.round(pitchToHz(l.freq!))])).toEqual([
      [0, 262],
      [3, 330],
    ]);
    expect(layers[0]!.dur).toBeGreaterThan(1.5);
  });

  it('references only defined cues and tracks', () => {
    const tracks = new Set(music.tracks.map((t) => t.id));
    expect(tracks.has(music.defaultTrack) && tracks.has(music.fishingTrack)).toBe(true);
    Object.values(music.seasonTracks).forEach((id) => expect(tracks.has(id)).toBe(true));
    expect(sounds.cues[ambience.bed]).toBeDefined();
    ambience.sources
      .flatMap((s) => s.cues)
      .forEach((cue) => expect(sounds.cues[cue]).toBeDefined());
  });
});

describe('cue limiter', () => {
  it('drops repeats inside the cooldown and caps voices', () => {
    const limiter = new CueLimiter(3);
    expect(limiter.tryStart('coin', { cooldownMs: 50 }, 0, 300)).toBe(true);
    expect(limiter.tryStart('coin', { cooldownMs: 50 }, 20, 300)).toBe(false);
    expect(limiter.tryStart('coin', { cooldownMs: 50, maxVoices: 1 }, 100, 300)).toBe(false);
    expect(limiter.tryStart('coin', { cooldownMs: 50, maxVoices: 1 }, 400, 300)).toBe(true);
    expect(limiter.tryStart('a', {}, 400, 300)).toBe(true);
    expect(limiter.tryStart('b', {}, 400, 300)).toBe(true);
    expect(limiter.tryStart('c', {}, 400, 300)).toBe(false);
    expect(limiter.activeVoices(800)).toBe(0);
  });

  it('lets fifty rapid clicks through only a handful of times', () => {
    const limiter = new CueLimiter(sounds.maxVoices);
    const click = sounds.cues.click!;
    let started = 0;
    for (let i = 0; i < 50; i++) if (limiter.tryStart('click', click, i * 5, 45)) started++;
    expect(started).toBeLessThanOrEqual(9);
  });
});

describe('game sounds', () => {
  it('plays success cues only when the action succeeded', () => {
    const session = newSession();
    const { played, play } = recorder();
    bindGameSounds(session, play);
    const plot = session.plots.ids()[0]!;
    expect(session.farm.harvest(plot).ok).toBe(false);
    expect(session.farm.plant(plot, 'no-such-crop').ok).toBe(false);
    expect(played).toEqual([]);

    session.economy.earn(100);
    played.length = 0;
    const crop = session.crops
      .all()
      .find((c) => session.plots.seasonRate(c.id) > 0 && c.plantOn === 'bed')!;
    expect(session.farm.plant(plot, crop.id).ok).toBe(true);
    expect(played).toEqual(['plant']);
    session.farm.water(plot);
    session.farm.water(plot);
    expect(played.filter((cue) => cue === 'water')).toHaveLength(1);
  });

  it('maps fishing, production and rewards to their cues', () => {
    const session = richSession();
    const { played, play } = recorder();
    bindGameSounds(session, play);
    session.fishing.startCast('pier');
    session.update(session.fishing.cast()!.biteAt - session.time.now() + 0.05);
    session.fishing.reel();
    expect(played.slice(0, 2)).toEqual(['cast', 'splash']);
    expect(played).toEqual(expect.arrayContaining(['bite', 'catch']));

    const mill = buildReady(session, 'grain-mill');
    session.inventory.add('wheat', 3);
    played.length = 0;
    session.production.start(mill, 'flour');
    session.update(session.content.recipes.get('flour').durationSec);
    session.production.collect(mill);
    expect(played).toEqual(
      expect.arrayContaining(['production-start', 'production-ready', 'collect']),
    );
  });

  it('stops listening when unbound', () => {
    const session = richSession();
    const { played, play } = recorder();
    bindGameSounds(session, play)();
    session.economy.earn(5);
    expect(played).toEqual([]);
  });
});

describe('music and ambience', () => {
  it('picks the fishing, seasonal or default track', () => {
    expect(pickTrack(music, { seasonId: 'spring', fishing: false })).toBe('farm');
    expect(pickTrack(music, { seasonId: 'winter', fishing: false })).toBe('winter');
    expect(pickTrack(music, { seasonId: 'winter', fishing: true })).toBe('fishing');
  });

  it('spaces ambient sounds out and skips sources that are not present', () => {
    const scheduler = new AmbientScheduler(ambience, () => 0.5);
    const winter = { seasonId: 'winter', features: new Set<string>() };
    const cues: string[] = [];
    for (let t = 0; t < 600; t++) {
      const cue = scheduler.update(1, winter);
      if (cue) cues.push(cue);
    }
    expect(cues.length).toBeGreaterThan(10);
    expect(cues.length).toBeLessThan(120);
    expect(cues.some((cue) => cue.startsWith('bird') || cue.startsWith('animal'))).toBe(false);

    const farm = { seasonId: 'spring', features: new Set(['animal:cow']) };
    const heard = new Set<string>();
    for (let t = 0; t < 600; t++) heard.add(scheduler.update(1, farm) ?? '');
    expect(heard.has('animal-cow')).toBe(true);
    expect(heard.has('animal-pig')).toBe(false);
  });

  it('never bursts after a long stall', () => {
    const scheduler = new AmbientScheduler(ambience, () => 0.5);
    const context = { seasonId: 'spring', features: new Set(['animal:cow']) };
    expect(scheduler.update(3600, context)).toBeNull();
  });
});
