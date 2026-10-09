import type { SoundBank } from './SoundBank';

interface Playing {
  id: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

const STOP_PAD_SEC = 0.1;

// One looping track at a time; changing tracks crossfades so there is never a hard cut.
export class MusicPlayer {
  private playing: Playing | null = null;
  private wanted: string | null = null;

  constructor(
    private readonly bank: SoundBank,
    private readonly fadeSec: number,
  ) {}

  get current(): string | null {
    return this.playing?.id ?? null;
  }

  /** Remembers the wish even before audio is unlocked or the track is baked. */
  request(id: string | null, ctx: AudioContext | null, output: AudioNode | null): void {
    this.wanted = id;
    if (ctx && output) this.sync(ctx, output);
  }

  sync(ctx: AudioContext, output: AudioNode): void {
    if (ctx.state !== 'running' || this.playing?.id === this.wanted) return;
    const buffer = this.wanted ? this.bank.loop(this.wanted) : undefined;
    if (this.wanted && !buffer) return;
    this.fadeOut(ctx);
    if (!this.wanted || !buffer) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + this.fadeSec);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(output);
    source.start();
    this.playing = { id: this.wanted, source, gain };
  }

  stop(ctx: AudioContext | null): void {
    if (ctx) this.fadeOut(ctx);
    else this.playing?.source.stop();
    this.playing = null;
  }

  private fadeOut(ctx: AudioContext): void {
    const old = this.playing;
    if (!old) return;
    this.playing = null;
    const now = ctx.currentTime;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + this.fadeSec);
    old.source.stop(now + this.fadeSec + STOP_PAD_SEC);
    old.source.onended = () => old.gain.disconnect();
  }
}
