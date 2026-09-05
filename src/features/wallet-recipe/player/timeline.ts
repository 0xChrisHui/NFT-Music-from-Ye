import { RECIPE_CROSSFADE_MS_V1 } from '@/src/lib/wallet-recipe/constants';
import type { PlayerError, WalletRecipePlayerInput } from './types';

const RECIPE_PATTERN = /^[A-Z0-9]{36}$/;

export type WalletRecipeSegment = {
  index: number;
  key: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  fadeInMs: number;
  fadeOutMs: number;
};

export type WalletRecipeTimeline = {
  segments: WalletRecipeSegment[];
  durationMs: number;
  uniqueKeys: string[];
};

function inputError(message: string): PlayerError {
  return Object.assign(new Error(message), { kind: 'invalid_input' as const });
}

export function createWalletRecipeTimeline(
  input: WalletRecipePlayerInput,
): WalletRecipeTimeline {
  if (!RECIPE_PATTERN.test(input.recipe)) {
    throw inputError('Pond Echo 配方必须是 36 位 A–Z / 0–9 字符');
  }
  const segments: WalletRecipeSegment[] = [];
  const uniqueKeys: string[] = [];
  const seen = new Set<string>();
  let startMs = 0;
  for (const [index, key] of [...input.recipe].entries()) {
    const clip = input.clips[key];
    if (!clip || !Number.isFinite(clip.durationMs) || clip.durationMs <= 120) {
      throw inputError(`配方字符 ${key} 缺少合法音频描述`);
    }
    if (!seen.has(key)) {
      seen.add(key);
      uniqueKeys.push(key);
    }
    const endMs = startMs + clip.durationMs;
    segments.push({
      index,
      key,
      startMs,
      endMs,
      durationMs: clip.durationMs,
      fadeInMs: index === 0 ? 0 : RECIPE_CROSSFADE_MS_V1,
      fadeOutMs: index === input.recipe.length - 1 ? 0 : RECIPE_CROSSFADE_MS_V1,
    });
    startMs = endMs - RECIPE_CROSSFADE_MS_V1;
  }
  return {
    segments,
    durationMs: segments.at(-1)?.endMs ?? 0,
    uniqueKeys,
  };
}

export function segmentAtPosition(
  timeline: WalletRecipeTimeline,
  positionMs: number,
): WalletRecipeSegment | null {
  if (timeline.segments.length === 0) return null;
  const position = Math.max(0, Math.min(positionMs, timeline.durationMs));
  for (let index = timeline.segments.length - 1; index >= 0; index -= 1) {
    if (timeline.segments[index].startMs <= position) return timeline.segments[index];
  }
  return timeline.segments[0];
}

export function equalPowerGain(segment: WalletRecipeSegment, clipOffsetMs: number): number {
  if (segment.fadeInMs > 0 && clipOffsetMs < segment.fadeInMs) {
    return Math.sin((Math.PI / 2) * Math.max(0, clipOffsetMs / segment.fadeInMs));
  }
  const fadeOutStart = segment.durationMs - segment.fadeOutMs;
  if (segment.fadeOutMs > 0 && clipOffsetMs > fadeOutStart) {
    return Math.cos(
      (Math.PI / 2) * Math.min(1, (clipOffsetMs - fadeOutStart) / segment.fadeOutMs),
    );
  }
  return 1;
}
