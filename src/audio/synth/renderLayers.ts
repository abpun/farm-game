import { pitchToHz } from '../notes';
import type { ToneLayer } from '../types';

const DEFAULT_ATTACK = 0.005;
const SILENCE = 0.0001;
const STOP_PAD = 0.02;
const NOISE_SEC = 1;

/** Seconds from the cue start until the last layer has finished. */
export const layersEnd = (layers: readonly ToneLayer[]): number =>
  layers.reduce((end, layer) => Math.max(end, (layer.delay ?? 0) + layer.dur), 0);

// Seeded so every boot bakes byte-identical noise.
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * NOISE_SEC), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x2f6b;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return buffer;
}

function sourceFor(ctx: BaseAudioContext, layer: ToneLayer, noise: AudioBuffer, start: number) {
  if (layer.wave === 'noise') {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    return source;
  }
  const osc = ctx.createOscillator();
  osc.type = layer.wave;
  const from = pitchToHz(layer.freq ?? 440);
  osc.frequency.setValueAtTime(from, start);
  if (layer.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(pitchToHz(layer.to), start + layer.dur);
  }
  if (layer.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = layer.vibrato.rate;
    depth.gain.value = layer.vibrato.depth;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + layer.dur + STOP_PAD);
  }
  return osc;
}

function envelope(ctx: BaseAudioContext, layer: ToneLayer, start: number): GainNode {
  const gain = ctx.createGain();
  const end = start + layer.dur;
  const attack = Math.min(layer.attack ?? DEFAULT_ATTACK, layer.dur / 2);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(layer.gain, start + attack);
  if (layer.release !== undefined) {
    gain.gain.setValueAtTime(layer.gain, Math.max(start + attack, end - layer.release));
    gain.gain.linearRampToValueAtTime(0, end);
  } else {
    gain.gain.exponentialRampToValueAtTime(SILENCE, end);
  }
  return gain;
}

/** Wires every layer into `destination`, timed from `offset` seconds. */
export function scheduleLayers(
  ctx: BaseAudioContext,
  destination: AudioNode,
  layers: readonly ToneLayer[],
  offset = 0,
): void {
  const noise = noiseBuffer(ctx);
  for (const layer of layers) {
    const start = offset + (layer.delay ?? 0);
    const source = sourceFor(ctx, layer, noise, start);
    let node: AudioNode = source;
    if (layer.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter.type;
      filter.frequency.setValueAtTime(layer.filter.freq, start);
      if (layer.filter.to !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(layer.filter.to, start + layer.dur);
      }
      if (layer.filter.q !== undefined) filter.Q.value = layer.filter.q;
      node = node.connect(filter);
    }
    node.connect(envelope(ctx, layer, start)).connect(destination);
    source.start(start);
    source.stop(start + layer.dur + STOP_PAD);
  }
}
