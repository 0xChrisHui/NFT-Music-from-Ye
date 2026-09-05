import type {
  ClipManifestV1,
  WalletRecipeMetadataClipV1,
  WalletRecipeMetadataV1,
} from '@/src/types/wallet-recipe';
import { parseClipManifestV1 } from './clip-manifest';
import {
  ARWEAVE_TX_ID_PATTERN,
  POND_ECHO_EXTERNAL_ORIGIN_BASE_URL,
  POND_ECHO_TOKEN_DESCRIPTION,
  WALLET_RECIPE_METADATA_MAX_BYTES,
} from './constants';
import {
  calculateRecipeDurationMs,
  collectRecipeKeys,
  deriveRecipeV1,
  normalizeOriginWallet,
} from './recipe-v1';

export type BuildWalletRecipeMetadataV1Input = {
  originWallet: string;
  sourceScoreTokenId: number;
  imageTxId: string;
  decoderTxId: string;
  clipManifestTxId: string;
  clipManifest: ClipManifestV1;
};

function assertTxId(txId: string, label: string): void {
  if (!ARWEAVE_TX_ID_PATTERN.test(txId)) {
    throw new Error(`${label} 必须是 43 位 Arweave txid`);
  }
}

function arUri(txId: string): `ar://${string}` {
  return `ar://${txId}`;
}

export function formatPondEchoName(originWallet: string): string {
  const wallet = normalizeOriginWallet(originWallet);
  return `Pond Echo · ${wallet.slice(2, 6)}—${wallet.slice(-4)}`;
}

export function buildPondEchoExternalUrl(originWallet: string): string {
  return `${POND_ECHO_EXTERNAL_ORIGIN_BASE_URL}/${normalizeOriginWallet(originWallet)}`;
}

function buildMetadataClips(
  recipe: string,
  manifest: ClipManifestV1,
): Record<string, WalletRecipeMetadataClipV1> {
  const byKey = new Map(manifest.clips.map((clip) => [clip.key, clip]));
  const clips: Record<string, WalletRecipeMetadataClipV1> = {};
  // 首次出现顺序让 JSON bytes 可复现；播放器仍只按 recipe 播放，绝不依赖 object 顺序。
  for (const key of collectRecipeKeys(recipe)) {
    const clip = byKey.get(key);
    if (!clip?.arweaveTxId) {
      throw new Error(`clip ${key} 尚未冻结 Arweave txid`);
    }
    assertTxId(clip.arweaveTxId, `clip ${key}.arweaveTxId`);
    clips[key] = {
      uri: arUri(clip.arweaveTxId),
      sha256: clip.sha256,
      durationMs: clip.durationMs,
    };
  }
  return clips;
}

export function buildWalletRecipeMetadataV1(
  input: BuildWalletRecipeMetadataV1Input,
): WalletRecipeMetadataV1 {
  const originWallet = normalizeOriginWallet(input.originWallet);
  if (!Number.isInteger(input.sourceScoreTokenId) || input.sourceScoreTokenId <= 0) {
    throw new Error('sourceScoreTokenId 必须是正整数');
  }
  assertTxId(input.imageTxId, 'imageTxId');
  assertTxId(input.decoderTxId, 'decoderTxId');
  assertTxId(input.clipManifestTxId, 'clipManifestTxId');
  const manifest = parseClipManifestV1(input.clipManifest);
  const recipe = deriveRecipeV1(originWallet);
  return {
    name: formatPondEchoName(originWallet),
    description: POND_ECHO_TOKEN_DESCRIPTION,
    image: arUri(input.imageTxId),
    animation_url:
      `${arUri(input.decoderTxId)}?v=1&recipe=${recipe}&clips=${input.clipManifestTxId}`,
    external_url: buildPondEchoExternalUrl(originWallet),
    attributes: [],
    properties: {
      recipeVersion: 1,
      recipe,
      originWallet,
      sourceScoreTokenId: input.sourceScoreTokenId,
      clipManifest: arUri(input.clipManifestTxId),
      clipManifestSha256: manifest.manifestSha256,
      durationMs: calculateRecipeDurationMs(recipe, manifest),
      clips: buildMetadataClips(recipe, manifest),
    },
  };
}

export function serializeWalletRecipeMetadataV1(
  metadata: WalletRecipeMetadataV1,
): string {
  const props = metadata.properties;
  const clipEntries = collectRecipeKeys(props.recipe).map((key) => {
    const clip = props.clips[key];
    if (!clip) throw new Error(`metadata clips 缺少 recipe key ${key}`);
    return `${JSON.stringify(key)}:${JSON.stringify(clip)}`;
  });
  // 手写字段次序是为了绕过 JS 会把 "0"–"9" object key 自动提前的枚举规则。
  const json = [
    `{"name":${JSON.stringify(metadata.name)}`,
    `,"description":${JSON.stringify(metadata.description)}`,
    `,"image":${JSON.stringify(metadata.image)}`,
    `,"animation_url":${JSON.stringify(metadata.animation_url)}`,
    `,"external_url":${JSON.stringify(metadata.external_url)}`,
    ',"attributes":[]',
    ',"properties":{"recipeVersion":1',
    `,"recipe":${JSON.stringify(props.recipe)}`,
    `,"originWallet":${JSON.stringify(props.originWallet)}`,
    `,"sourceScoreTokenId":${props.sourceScoreTokenId}`,
    `,"clipManifest":${JSON.stringify(props.clipManifest)}`,
    `,"clipManifestSha256":${JSON.stringify(props.clipManifestSha256)}`,
    `,"durationMs":${props.durationMs}`,
    `,"clips":{${clipEntries.join(',')}}}}`,
  ].join('');
  const byteLength = new TextEncoder().encode(json).byteLength;
  if (byteLength > WALLET_RECIPE_METADATA_MAX_BYTES) {
    throw new Error(
      `wallet recipe metadata 为 ${byteLength} bytes，超过 32 KiB 上限`,
    );
  }
  return json;
}

export function buildWalletRecipeMetadataJsonV1(
  input: BuildWalletRecipeMetadataV1Input,
): string {
  return serializeWalletRecipeMetadataV1(buildWalletRecipeMetadataV1(input));
}
