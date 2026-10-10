import { channelGain, type Settings } from '@core/settings/settings';
import type { SettingsStore } from '@core/settings/SettingsStore';
import { CueLimiter } from './CueLimiter';
import { MusicPlayer } from './MusicPlayer';
import type { SoundBank } from './SoundBank';
import type { SoundChannel } from './types';

const MS_PER_SEC = 1000;
const GAIN_SMOOTH_SEC = 0.05;
const HIDE_FADE_SEC = 0.1;
const RETURN_FADE_SEC = 0.6;
/** Events that piled up while the tab was hidden stay silent for this long after return. */
const RETURN_QUIET_MS = 500;
const DUCK_ATTACK_SEC = 0.06;
const DUCK_RELEASE_SEC = 0.5;
const BED_FADE_SEC = 0.8;
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

export interface PlayOptions {
  delay?: number;
  /** Overrides the cue's own channel, e.g. an animal call heard as ambience. */
  channel?: SoundChannel;
}

interface Buses {
  master: GainNode;
  music: GainNode;
  duck: GainNode;
  sfx: GainNode;
  ambient: GainNode;
}

type AudioContextCtor = typeof AudioContext;

// The one place that touches Web Audio for playback. The context is created on the first
// user gesture (autoplay rules), suspended while the tab is hidden, and every failure is
// logged and swallowed so sound can never break the game.
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buses: Buses | null = null;
  private bed: AudioBufferSourceNode | null = null;
  private bedGain: GainNode | null = null;
  private bedLevel = 1;
  private readonly limiter: CueLimiter;
  private readonly music: MusicPlayer;
  private readonly offSettings: () => void;
  private quietUntil = 0;
  private destroyed = false;

  constructor(
    private readonly bank: SoundBank,
    private readonly settings: SettingsStore,
  ) {
    this.limiter = new CueLimiter(bank.sounds.maxVoices);
    this.music = new MusicPlayer(bank, bank.music.fadeSec);
    this.offSettings = settings.onChange((next) => this.applySettings(next));
    bank.onLoopReady(() => this.syncLoops());
    UNLOCK_EVENTS.forEach((type) => window.addEventListener(type, this.unlock, true));
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get state(): AudioContextState | 'locked' {
    return this.ctx?.state ?? 'locked';
  }

  get currentTrack(): string | null {
    return this.music.current;
  }

  /** Plays a named cue; returns false if it was skipped (muted tab, limiter, not ready). */
  play(cue: string, options: PlayOptions = {}): boolean {
    const ctx = this.ctx;
    const buses = this.buses;
    const def = this.bank.cueDef(cue);
    const buffer = this.bank.cue(cue);
    if (!ctx || !buses || !def || !buffer || !this.audible()) return false;
    const channel = options.channel ?? def.channel ?? 'sfx';
    if (channelGain(this.settings.get(), channel) === 0) return false;
    const durationMs = buffer.duration * MS_PER_SEC;
    if (!this.limiter.tryStart(cue, def, performance.now(), durationMs)) return false;
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const jitter = def.pitchJitter ?? 0;
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
      source.connect(buses[channel]);
      const at = ctx.currentTime + Math.max(0, options.delay ?? 0);
      source.onended = () => source.disconnect();
      source.start(at);
      if (def.duck !== undefined) this.duck(def.duck, at, buffer.duration);
      return true;
    } catch (error) {
      console.warn(`Could not play "${cue}"`, error);
      return false;
    }
  }

  /** Fades the looping sea bed (0 underground, 1 by the shore). */
  setBedLevel(level: number): void {
    if (level === this.bedLevel) return;
    this.bedLevel = level;
    const { ctx, bedGain } = this;
    if (ctx && bedGain) bedGain.gain.setTargetAtTime(level, ctx.currentTime, BED_FADE_SEC);
  }

  setMusic(trackId: string | null): void {
    this.music.request(trackId, this.ctx, this.buses?.duck ?? null);
  }

  destroy(): void {
    this.destroyed = true;
    this.bank.cancel();
    this.offSettings();
    UNLOCK_EVENTS.forEach((type) => window.removeEventListener(type, this.unlock, true));
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.music.stop(null);
    this.bed?.stop();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.buses = null;
  }

  private audible(): boolean {
    return (
      this.ctx?.state === 'running' && !document.hidden && performance.now() >= this.quietUntil
    );
  }

  private readonly unlock = (): void => {
    if (this.destroyed) return;
    try {
      if (!this.ctx) this.createContext();
      if (this.ctx?.state === 'suspended' && !document.hidden) {
        void this.ctx.resume().then(this.onResumed, () => undefined);
      }
    } catch (error) {
      console.warn('Audio is unavailable', error);
      this.removeUnlockListeners();
    }
  };

  private readonly onResumed = (): void => {
    if (this.ctx?.state !== 'running') return;
    this.removeUnlockListeners();
    this.syncLoops();
  };

  private removeUnlockListeners(): void {
    UNLOCK_EVENTS.forEach((type) => window.removeEventListener(type, this.unlock, true));
  }

  private createContext(): void {
    const Ctor = (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext) as
      AudioContextCtor | undefined;
    if (!Ctor) throw new Error('Web Audio is not supported');
    const ctx = new Ctor();
    const bus = () => ctx.createGain();
    const buses: Buses = { master: bus(), music: bus(), duck: bus(), sfx: bus(), ambient: bus() };
    buses.master.connect(ctx.destination);
    buses.duck.connect(buses.music).connect(buses.master);
    buses.sfx.connect(buses.master);
    buses.ambient.connect(buses.master);
    this.ctx = ctx;
    this.buses = buses;
    this.applySettings(this.settings.get(), true);
  }

  private applySettings(settings: Settings, immediate = false): void {
    const { ctx, buses } = this;
    if (!ctx || !buses) return;
    const set = (node: GainNode, value: number) => {
      if (immediate) node.gain.value = value;
      else node.gain.setTargetAtTime(value, ctx.currentTime, GAIN_SMOOTH_SEC);
    };
    // Channel buses carry master × channel; the master bus is reserved for tab fades.
    set(buses.music, channelGain(settings, 'music'));
    set(buses.sfx, channelGain(settings, 'sfx'));
    set(buses.ambient, channelGain(settings, 'ambient'));
  }

  private syncLoops(): void {
    const { ctx, buses } = this;
    if (!ctx || !buses || ctx.state !== 'running') return;
    this.music.sync(ctx, buses.duck);
    this.startBed(ctx, buses.ambient);
  }

  private startBed(ctx: AudioContext, output: AudioNode): void {
    const buffer = this.bank.loop(this.bank.ambience.bed);
    if (this.bed || !buffer) return;
    this.bed = ctx.createBufferSource();
    this.bed.buffer = buffer;
    this.bed.loop = true;
    this.bedGain = ctx.createGain();
    this.bedGain.gain.value = this.bedLevel;
    this.bed.connect(this.bedGain).connect(output);
    this.bed.start();
  }

  private duck(level: number, at: number, duration: number): void {
    const gain = this.buses?.duck.gain;
    if (!gain) return;
    gain.cancelScheduledValues(at);
    gain.setTargetAtTime(level, at, DUCK_ATTACK_SEC / 3);
    gain.setTargetAtTime(1, at + duration, DUCK_RELEASE_SEC / 3);
  }

  private readonly onVisibility = (): void => {
    const { ctx, buses } = this;
    if (!ctx || !buses) return;
    const now = ctx.currentTime;
    const master = buses.master.gain;
    master.cancelScheduledValues(now);
    if (document.hidden) {
      master.setValueAtTime(master.value, now);
      master.linearRampToValueAtTime(0, now + HIDE_FADE_SEC);
      this.limiter.clear();
      window.setTimeout(() => {
        if (document.hidden && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
      }, HIDE_FADE_SEC * MS_PER_SEC);
      return;
    }
    this.quietUntil = performance.now() + RETURN_QUIET_MS;
    master.setValueAtTime(0, now);
    void ctx.resume().then(
      () => {
        const t = ctx.currentTime;
        master.cancelScheduledValues(t);
        master.setValueAtTime(0, t);
        master.linearRampToValueAtTime(1, t + RETURN_FADE_SEC);
        this.syncLoops();
      },
      () => undefined,
    );
  };
}
