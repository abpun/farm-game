import type { ToneLayer } from '../types';
import { layersEnd, scheduleLayers } from './renderLayers';

const TAIL_PAD_SEC = 0.05;

function normalize(buffer: AudioBuffer, peak: number): AudioBuffer {
  const data = buffer.getChannelData(0);
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i] ?? 0));
  if (max === 0) return buffer;
  const scale = peak / max;
  for (let i = 0; i < data.length; i++) data[i] = (data[i] ?? 0) * scale;
  return buffer;
}

async function render(layers: readonly ToneLayer[], seconds: number, sampleRate: number) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  scheduleLayers(ctx, ctx.destination, layers);
  return ctx.startRendering();
}

/** Renders a one-shot cue, peak-normalized so cue gains in data are comparable. */
export async function bakeCue(
  layers: readonly ToneLayer[],
  sampleRate: number,
  peak: number,
): Promise<AudioBuffer> {
  return normalize(await render(layers, layersEnd(layers) + TAIL_PAD_SEC, sampleRate), peak);
}

// Renders past the loop end, then folds the ringing tail back onto the start
// so the buffer loops with no gap and no cut-off notes.
export async function bakeLoop(
  layers: readonly ToneLayer[],
  loopSec: number,
  sampleRate: number,
  peak: number,
): Promise<AudioBuffer> {
  const full = await render(
    layers,
    Math.max(loopSec, layersEnd(layers)) + TAIL_PAD_SEC,
    sampleRate,
  );
  const length = Math.round(loopSec * sampleRate);
  const loop = new AudioBuffer({ length, sampleRate, numberOfChannels: 1 });
  const source = full.getChannelData(0);
  const target = loop.getChannelData(0);
  for (let i = 0; i < source.length; i++) {
    const at = i % length;
    target[at] = (target[at] ?? 0) + (source[i] ?? 0);
  }
  return normalize(loop, peak);
}

/** Decodes a recorded file; resolves null when it is missing or unreadable. */
export async function loadFile(url: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    return await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
  } catch (error) {
    console.warn(`Audio file ${url} unavailable, using the synthesized sound`, error);
    return null;
  }
}
