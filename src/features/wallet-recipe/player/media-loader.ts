import { fetchPermanentAudio } from './permanent-fetch';
import type { WalletRecipeTimeline } from './timeline';
import type { PlayerError, WalletRecipePlayerInput } from './types';

// 典型 recipe 约 23 个唯一片段；12 路将网关往返压到约 2 批，压缩总量与解码内存不变。
const LOAD_CONCURRENCY = 12;
const DECODE_DURATION_TOLERANCE_MS = 3;

export async function loadWalletRecipeAudio(
  input: WalletRecipePlayerInput,
  timeline: WalletRecipeTimeline,
  fetcher: typeof fetch,
  signal: AbortSignal,
  onLoaded: (loaded: number) => void,
): Promise<Map<string, ArrayBuffer>> {
  const compressed = new Map<string, ArrayBuffer>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < timeline.uniqueKeys.length) {
      const key = timeline.uniqueKeys[cursor++];
      const clip = input.clips[key];
      const bytes = await fetchPermanentAudio(clip.uri, clip.sha256, fetcher, signal);
      compressed.set(key, bytes);
      onLoaded(compressed.size);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(LOAD_CONCURRENCY, timeline.uniqueKeys.length) }, worker,
  ));
  return compressed;
}

export async function decodeWalletRecipeAudio(
  context: AudioContext,
  input: WalletRecipePlayerInput,
  compressed: Map<string, ArrayBuffer>,
): Promise<Map<string, AudioBuffer>> {
  const entries = await Promise.all([...compressed].map(async ([key, bytes]) => {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const expectedMs = input.clips[key].durationMs;
    if (Math.abs(buffer.duration * 1000 - expectedMs) > DECODE_DURATION_TOLERANCE_MS) {
      const error = new Error(`音频 ${key} 解码时长与永久 metadata 不一致`);
      throw Object.assign(error, { kind: 'integrity' as const }) satisfies PlayerError;
    }
    return [key, buffer] as const;
  }));
  return new Map(entries);
}
