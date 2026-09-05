import assert from 'node:assert/strict';
import type { Address } from 'viem';
import manifestJson from '../../src/features/wallet-recipe/clips-v1.json';
import type { ClipManifestV1 } from '../../src/types/wallet-recipe';
import {
  parseClipManifestJsonV1,
  parseClipManifestV1,
  serializeClipManifestV1,
} from '../../src/lib/wallet-recipe/clip-manifest';
import {
  parsePondEchoCollectionMetadataV1,
  serializePondEchoCollectionMetadataV1,
} from '../../src/lib/wallet-recipe/collection-metadata';
import {
  RECIPE_CHARSET_V1,
  RECIPE_CROSSFADE_MS_V1,
} from '../../src/lib/wallet-recipe/constants';
import {
  buildWalletRecipeMetadataJsonV1,
  buildWalletRecipeMetadataV1,
} from '../../src/lib/wallet-recipe/metadata';
import { parseWalletRecipeMetadataJsonV1 } from '../../src/lib/wallet-recipe/metadata-parser';
import {
  calculateRecipeDurationMs,
  collectRecipeKeys,
  deriveRecipeV1,
  deriveRecipeV1Trace,
  normalizeOriginWallet,
} from '../../src/lib/wallet-recipe/recipe-v1';
import { RECIPE_V1_TEST_VECTORS } from '../../src/lib/wallet-recipe/vectors-v1';

const manifest = parseClipManifestV1(manifestJson);

function verifyFrozenVectors(): void {
  assert.equal(RECIPE_V1_TEST_VECTORS.length, 8);
  for (const vector of RECIPE_V1_TEST_VECTORS) {
    const trace = deriveRecipeV1Trace(vector.wallet);
    assert.equal(trace.wallet, vector.wallet, `${vector.label}: checksum`);
    assert.equal(trace.address20Hex, vector.address20Hex, `${vector.label}: address20`);
    assert.equal(trace.firstBlock, vector.firstBlock, `${vector.label}: first block`);
    assert.equal(trace.rejectedByteCount, vector.rejectedByteCount, `${vector.label}: rejects`);
    assert.equal(trace.recipe, vector.recipe, `${vector.label}: recipe`);
    assert.equal(
      calculateRecipeDurationMs(trace.recipe, manifest),
      vector.durationMs,
      `${vector.label}: duration`,
    );
  }
  assert.ok(
    RECIPE_V1_TEST_VECTORS.some((vector) => vector.rejectedByteCount > 0),
    '固定向量必须真实命中 252–255 拒绝路径',
  );
  const scoreOne = RECIPE_V1_TEST_VECTORS[6];
  const rawDuration = [...scoreOne.recipe].reduce((sum, key) => {
    const clip = manifest.clips.find((candidate) => candidate.key === key);
    assert.ok(clip);
    return sum + clip.durationMs;
  }, 0);
  assert.equal(
    Math.round((rawDuration - scoreOne.durationMs) * 1_000_000) / 1_000_000,
    RECIPE_CROSSFADE_MS_V1 * (scoreOne.recipe.length - 1),
    '总时长必须扣除 35 个真实交叉淡化重叠区间',
  );
}

function verifyAddressContract(): void {
  const lowercase = '0x1234567890abcdef1234567890abcdef12345678';
  const uppercase = '0x1234567890ABCDEF1234567890ABCDEF12345678';
  const arbitraryCase = '0x1234567890aBCDef1234567890AbCDef12345678';
  assert.equal(deriveRecipeV1(lowercase), deriveRecipeV1(uppercase));
  assert.equal(deriveRecipeV1(lowercase), deriveRecipeV1(arbitraryCase));
  assert.equal(
    normalizeOriginWallet(arbitraryCase),
    '0x1234567890AbcdEF1234567890aBcdef12345678',
  );
  for (const invalid of [
    '0x0000000000000000000000000000000000000000',
    '0x1234',
    '0xgggggggggggggggggggggggggggggggggggggggg',
    '0x111111111111111111111111111111111111111111',
  ]) {
    assert.throws(() => normalizeOriginWallet(invalid));
  }
}

function verifyDistribution(): void {
  const frequencies = new Map([...RECIPE_CHARSET_V1].map((key) => [key, 0]));
  let rejected = 0;
  let consumed = 0;
  for (let index = 1; index <= 10_000; index += 1) {
    const wallet = `0x${index.toString(16).padStart(40, '0')}` as Address;
    const trace = deriveRecipeV1Trace(wallet);
    rejected += trace.rejectedByteCount;
    consumed += trace.consumedByteCount;
    for (const key of trace.recipe) {
      frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
    }
  }
  const expected = 360_000 / RECIPE_CHARSET_V1.length;
  for (const [key, count] of frequencies) {
    assert.ok(Math.abs(count - expected) / expected <= 0.04, `${key} 频率偏差超过 4%`);
  }
  const rejectionRatio = rejected / consumed;
  assert.ok(rejectionRatio >= 0.012 && rejectionRatio <= 0.019);
  assert.equal(rejected, 5_668);
  assert.equal(consumed, 365_668);
}

function finalizedManifestFixture(): ClipManifestV1 {
  return parseClipManifestV1({
    ...manifest,
    clips: manifest.clips.map((clip, index) => ({
      ...clip,
      arweaveTxId:
        `${clip.key}${index.toString(36).padStart(2, '0')}${'x'.repeat(40)}`,
    })),
  });
}

function verifyManifestContract(): void {
  const serialized = serializeClipManifestV1(manifest);
  assert.deepEqual(parseClipManifestJsonV1(serialized), manifest);
  assert.equal(manifest.clips.length, 36);
  assert.equal(manifest.clips.map((clip) => clip.key).join(''), RECIPE_CHARSET_V1);
  assert.ok(manifest.clips.some((clip) => !Number.isInteger(clip.durationMs)));

  const duplicateHash = structuredClone(manifest);
  duplicateHash.clips[1].sha256 = duplicateHash.clips[0].sha256;
  assert.throws(() => parseClipManifestV1(duplicateHash), /互不重复/);
  assert.throws(
    () => parseClipManifestV1({ ...manifest, unexpected: true }),
    /字段必须恰好为/,
  );
}

function verifyMetadataContract(): void {
  const clipManifest = finalizedManifestFixture();
  const input = {
    originWallet: RECIPE_V1_TEST_VECTORS[6].wallet,
    sourceScoreTokenId: 1,
    imageTxId: 'I'.repeat(43),
    decoderTxId: 'D'.repeat(43),
    clipManifestTxId: 'M'.repeat(43),
    clipManifest,
  };
  const metadata = buildWalletRecipeMetadataV1(input);
  const json = buildWalletRecipeMetadataJsonV1(input);
  const context = {
    decoderTxId: input.decoderTxId,
    clipManifestTxId: input.clipManifestTxId,
    clipManifest,
    imageTxId: input.imageTxId,
  };
  assert.deepEqual(parseWalletRecipeMetadataJsonV1(json, context), metadata);
  assert.equal(metadata.name, 'Pond Echo · 19da—bA54');
  assert.equal(
    metadata.external_url,
    `https://pond-ripple.xyz/echo/origin/${input.originWallet}`,
  );
  assert.deepEqual(collectRecipeKeys(metadata.properties.recipe), [
    ...new Set(metadata.properties.recipe),
  ]);
  assert.equal(json, buildWalletRecipeMetadataJsonV1(input));
  assert.equal(metadata.properties.durationMs, RECIPE_V1_TEST_VECTORS[6].durationMs);

  const wrongRecipe = JSON.parse(json) as { properties: { recipe: string } };
  wrongRecipe.properties.recipe = wrongRecipe.properties.recipe.toLowerCase();
  assert.throws(
    () => parseWalletRecipeMetadataJsonV1(JSON.stringify(wrongRecipe), context),
    /非法字符/,
  );
  const wrongDuration = JSON.parse(json) as { properties: { durationMs: number } };
  wrongDuration.properties.durationMs += 1;
  assert.throws(
    () => parseWalletRecipeMetadataJsonV1(JSON.stringify(wrongDuration), context),
    /合同不一致/,
  );
  const wrongDecoder = JSON.parse(json) as { animation_url: string };
  wrongDecoder.animation_url = 'https://example.com/player.js';
  assert.throws(
    () => parseWalletRecipeMetadataJsonV1(JSON.stringify(wrongDecoder), context),
    /合同不一致/,
  );
  assert.throws(
    () => parseWalletRecipeMetadataJsonV1(`${json}${' '.repeat(33_000)}`, context),
    /32 KiB/,
  );
  assert.throws(() => buildWalletRecipeMetadataV1({ ...input, sourceScoreTokenId: 0 }));
}

function verifyCollectionMetadataContract(): void {
  const imageTxId = 'I'.repeat(43);
  const json = serializePondEchoCollectionMetadataV1(imageTxId);
  assert.deepEqual(parsePondEchoCollectionMetadataV1(JSON.parse(json)), {
    name: 'Pond Echoes',
    description: 'A permanent wallet-born score from Ripples in the Pond, composed from a deterministic 36-part recipe.',
    image: `ar://${imageTxId}`,
    external_link: 'https://pond-ripple.xyz',
  });
  assert.throws(() => parsePondEchoCollectionMetadataV1({
    ...JSON.parse(json),
    creator: 'unregistered-field',
  }), /字段合同/);
}

verifyFrozenVectors();
verifyAddressContract();
verifyDistribution();
verifyManifestContract();
verifyMetadataContract();
verifyCollectionMetadataContract();
console.log('P14-B Recipe v1、10,000 地址统计与 metadata 合同验证通过');
