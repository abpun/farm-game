export interface LimitRule {
  cooldownMs?: number;
  maxVoices?: number;
}

const DEFAULT_MAX_VOICES = 3;

// Keeps bursts of the same event from stacking into noise: a per-cue cooldown,
// a per-cue voice cap and a global voice cap. Time is passed in.
export class CueLimiter {
  private readonly lastStart = new Map<string, number>();
  private voices: Array<{ cue: string; endsAt: number }> = [];

  constructor(private readonly maxVoices: number) {}

  tryStart(cue: string, rule: LimitRule, nowMs: number, durationMs: number): boolean {
    this.voices = this.voices.filter((voice) => voice.endsAt > nowMs);
    const last = this.lastStart.get(cue);
    if (last !== undefined && nowMs - last < (rule.cooldownMs ?? 0)) return false;
    const sameCue = this.voices.filter((voice) => voice.cue === cue).length;
    if (sameCue >= (rule.maxVoices ?? DEFAULT_MAX_VOICES)) return false;
    if (this.voices.length >= this.maxVoices) return false;
    this.lastStart.set(cue, nowMs);
    this.voices.push({ cue, endsAt: nowMs + durationMs });
    return true;
  }

  activeVoices(nowMs: number): number {
    return this.voices.filter((voice) => voice.endsAt > nowMs).length;
  }

  clear(): void {
    this.voices = [];
    this.lastStart.clear();
  }
}
