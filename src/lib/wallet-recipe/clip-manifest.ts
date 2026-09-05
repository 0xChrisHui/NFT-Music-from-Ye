import type { ClipManifestV1, P14ClipV1 } from '@/src/types/wallet-recipe';
import {
  ARWEAVE_TX_ID_PATTERN,
  CLIP_MANIFEST_COUNT_V1,
  RECIPE_CHARSET_V1,
  SHA256_HEX_PATTERN,
} from './constants';

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} 必须是 JSON object`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} 字段必须恰好为：${expected.join(', ')}`);
  }
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || typeof value !== 'number' || value <= 0) {
    throw new Error(`${label} 必须是正整数`);
  }
  return value;
}

function positiveNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} 必须是有限正数`);
  }
  return value;
}

function parseClip(value: unknown, expectedKey: string, index: number): P14ClipV1 {
  const clip = asRecord(value, `clips[${index}]`);
  assertExactKeys(
    clip,
    [
      'key', 'fileName', 'bytes', 'mimeType', 'sha256', 'sampleRate',
      'channels', 'frameCount', 'durationMs', 'arweaveTxId',
    ],
    `clips[${index}]`,
  );
  if (clip.key !== expectedKey || clip.fileName !== `${expectedKey}.mp3`) {
    throw new Error(`clips[${index}] 必须按字符表顺序对应 ${expectedKey}.mp3`);
  }
  if (clip.mimeType !== 'audio/mpeg') {
    throw new Error(`clips[${index}].mimeType 必须是 audio/mpeg`);
  }
  if (typeof clip.sha256 !== 'string' || !SHA256_HEX_PATTERN.test(clip.sha256)) {
    throw new Error(`clips[${index}].sha256 必须是 64 位小写 hex`);
  }
  if (
    clip.arweaveTxId !== null
    && (typeof clip.arweaveTxId !== 'string' || !ARWEAVE_TX_ID_PATTERN.test(clip.arweaveTxId))
  ) {
    throw new Error(`clips[${index}].arweaveTxId 必须为 null 或 43 位 txid`);
  }
  return {
    key: expectedKey,
    fileName: `${expectedKey}.mp3`,
    bytes: positiveInteger(clip.bytes, `clips[${index}].bytes`),
    mimeType: 'audio/mpeg',
    sha256: clip.sha256,
    sampleRate: positiveInteger(clip.sampleRate, `clips[${index}].sampleRate`),
    channels: positiveInteger(clip.channels, `clips[${index}].channels`),
    frameCount: positiveInteger(clip.frameCount, `clips[${index}].frameCount`),
    durationMs: positiveNumber(clip.durationMs, `clips[${index}].durationMs`),
    arweaveTxId: clip.arweaveTxId,
  };
}

export function parseClipManifestV1(input: unknown): ClipManifestV1 {
  const manifest = asRecord(input, 'clip manifest');
  assertExactKeys(
    manifest,
    ['version', 'charset', 'count', 'generatedAt', 'clips', 'manifestSha256'],
    'clip manifest',
  );
  if (
    manifest.version !== 1
    || manifest.charset !== RECIPE_CHARSET_V1
    || manifest.count !== CLIP_MANIFEST_COUNT_V1
  ) {
    throw new Error('clip manifest 的 version、charset 或 count 不符合 v1');
  }
  if (
    typeof manifest.generatedAt !== 'string'
    || Number.isNaN(Date.parse(manifest.generatedAt))
  ) {
    throw new Error('clip manifest.generatedAt 必须是合法时间字符串');
  }
  if (!Array.isArray(manifest.clips) || manifest.clips.length !== CLIP_MANIFEST_COUNT_V1) {
    throw new Error(`clip manifest.clips 必须恰好有 ${CLIP_MANIFEST_COUNT_V1} 项`);
  }
  if (
    typeof manifest.manifestSha256 !== 'string'
    || !SHA256_HEX_PATTERN.test(manifest.manifestSha256)
  ) {
    throw new Error('clip manifest.manifestSha256 必须是 64 位小写 hex');
  }
  const clips = manifest.clips.map((clip, index) =>
    parseClip(clip, RECIPE_CHARSET_V1[index], index));
  if (new Set(clips.map((clip) => clip.sha256)).size !== CLIP_MANIFEST_COUNT_V1) {
    throw new Error('clip manifest 的 36 个内容 sha256 必须互不重复');
  }
  return {
    version: 1,
    charset: RECIPE_CHARSET_V1,
    count: CLIP_MANIFEST_COUNT_V1,
    generatedAt: manifest.generatedAt,
    clips,
    manifestSha256: manifest.manifestSha256,
  };
}

export function parseClipManifestJsonV1(json: string): ClipManifestV1 {
  let input: unknown;
  try {
    input = JSON.parse(json) as unknown;
  } catch {
    throw new Error('clip manifest 不是合法 JSON');
  }
  return parseClipManifestV1(input);
}

export function serializeClipManifestV1(manifest: ClipManifestV1): string {
  return JSON.stringify(parseClipManifestV1(manifest));
}
