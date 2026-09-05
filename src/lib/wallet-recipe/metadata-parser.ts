import type {
  RecipeV1,
  WalletRecipeMetadataClipV1,
  WalletRecipeMetadataV1,
} from '@/src/types/wallet-recipe';
import {
  ARWEAVE_TX_ID_PATTERN,
  SHA256_HEX_PATTERN,
  WALLET_RECIPE_METADATA_MAX_BYTES,
} from './constants';
import {
  buildWalletRecipeMetadataV1,
  type BuildWalletRecipeMetadataV1Input,
} from './metadata';
import { assertRecipeV1, collectRecipeKeys, normalizeOriginWallet } from './recipe-v1';

export type WalletRecipeMetadataV1Context = Pick<
  BuildWalletRecipeMetadataV1Input,
  'decoderTxId' | 'clipManifestTxId' | 'clipManifest'
> & { imageTxId?: string };

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

function txIdFromArUri(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.startsWith('ar://')) {
    throw new Error(`${label} 必须是 ar:// URI`);
  }
  const txId = value.slice(5);
  if (!ARWEAVE_TX_ID_PATTERN.test(txId)) {
    throw new Error(`${label} 必须只包含 43 位 Arweave txid`);
  }
  return txId;
}

function parseRecipe(value: unknown): RecipeV1 {
  if (typeof value !== 'string') throw new Error('properties.recipe 必须是字符串');
  assertRecipeV1(value);
  return value;
}

function parseClip(
  value: unknown,
  key: string,
): WalletRecipeMetadataClipV1 {
  const clip = asRecord(value, `properties.clips.${key}`);
  assertExactKeys(clip, ['uri', 'sha256', 'durationMs'], `properties.clips.${key}`);
  txIdFromArUri(clip.uri, `properties.clips.${key}.uri`);
  if (typeof clip.sha256 !== 'string' || !SHA256_HEX_PATTERN.test(clip.sha256)) {
    throw new Error(`properties.clips.${key}.sha256 必须是 64 位小写 hex`);
  }
  if (typeof clip.durationMs !== 'number' || !Number.isFinite(clip.durationMs) || clip.durationMs <= 0) {
    throw new Error(`properties.clips.${key}.durationMs 必须是有限正数`);
  }
  return {
    uri: clip.uri as `ar://${string}`,
    sha256: clip.sha256,
    durationMs: clip.durationMs,
  };
}

function parseClips(value: unknown, recipe: RecipeV1): Record<string, WalletRecipeMetadataClipV1> {
  const input = asRecord(value, 'properties.clips');
  const keys = collectRecipeKeys(recipe);
  assertExactKeys(input, keys, 'properties.clips');
  return Object.fromEntries(keys.map((key) => [key, parseClip(input[key], key)]));
}

function parseProperties(value: unknown): WalletRecipeMetadataV1['properties'] {
  const props = asRecord(value, 'properties');
  assertExactKeys(props, [
    'recipeVersion', 'recipe', 'originWallet', 'sourceScoreTokenId',
    'clipManifest', 'clipManifestSha256', 'durationMs', 'clips',
  ], 'properties');
  if (props.recipeVersion !== 1) throw new Error('properties.recipeVersion 必须是 1');
  const recipe = parseRecipe(props.recipe);
  const originWallet = normalizeOriginWallet(String(props.originWallet));
  if (props.originWallet !== originWallet) {
    throw new Error('properties.originWallet 必须保存 checksum 地址');
  }
  if (typeof props.sourceScoreTokenId !== 'number' || !Number.isInteger(props.sourceScoreTokenId) || props.sourceScoreTokenId <= 0) {
    throw new Error('properties.sourceScoreTokenId 必须是正整数');
  }
  txIdFromArUri(props.clipManifest, 'properties.clipManifest');
  if (typeof props.clipManifestSha256 !== 'string' || !SHA256_HEX_PATTERN.test(props.clipManifestSha256)) {
    throw new Error('properties.clipManifestSha256 必须是 64 位小写 hex');
  }
  if (typeof props.durationMs !== 'number' || !Number.isFinite(props.durationMs) || props.durationMs <= 0) {
    throw new Error('properties.durationMs 必须是有限正数');
  }
  return {
    recipeVersion: 1,
    recipe,
    originWallet,
    sourceScoreTokenId: props.sourceScoreTokenId,
    clipManifest: props.clipManifest as `ar://${string}`,
    clipManifestSha256: props.clipManifestSha256,
    durationMs: props.durationMs,
    clips: parseClips(props.clips, recipe),
  };
}

export function parseWalletRecipeMetadataV1(
  value: unknown,
  context: WalletRecipeMetadataV1Context,
): WalletRecipeMetadataV1 {
  const input = asRecord(value, 'metadata');
  assertExactKeys(input, [
    'name', 'description', 'image', 'animation_url',
    'external_url', 'attributes', 'properties',
  ], 'metadata');
  if (!Array.isArray(input.attributes) || input.attributes.length !== 0) {
    throw new Error('metadata.attributes v1 必须是空数组');
  }
  const properties = parseProperties(input.properties);
  const imageTxId = txIdFromArUri(input.image, 'metadata.image');
  if (context.imageTxId && imageTxId !== context.imageTxId) {
    throw new Error('metadata.image 与冻结封面 txid 不一致');
  }
  const expected = buildWalletRecipeMetadataV1({
    originWallet: properties.originWallet,
    sourceScoreTokenId: properties.sourceScoreTokenId,
    imageTxId,
    decoderTxId: context.decoderTxId,
    clipManifestTxId: context.clipManifestTxId,
    clipManifest: context.clipManifest,
  });
  const normalized: WalletRecipeMetadataV1 = {
    name: String(input.name),
    description: String(input.description),
    image: input.image as `ar://${string}`,
    animation_url: String(input.animation_url) as `ar://${string}`,
    external_url: String(input.external_url),
    attributes: [],
    properties,
  };
  if (JSON.stringify(normalized) !== JSON.stringify(expected)) {
    throw new Error('metadata 与 origin recipe、冻结 manifest 或永久 URL 合同不一致');
  }
  return expected;
}

export function parseWalletRecipeMetadataJsonV1(
  json: string,
  context: WalletRecipeMetadataV1Context,
): WalletRecipeMetadataV1 {
  if (new TextEncoder().encode(json).byteLength > WALLET_RECIPE_METADATA_MAX_BYTES) {
    throw new Error('wallet recipe metadata 超过 32 KiB 上限');
  }
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error('wallet recipe metadata 不是合法 JSON');
  }
  return parseWalletRecipeMetadataV1(value, context);
}
