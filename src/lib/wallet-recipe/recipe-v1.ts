import {
  concatHex,
  getAddress,
  hexToBytes,
  keccak256,
  numberToHex,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import type { ClipManifestV1, RecipeV1 } from '@/src/types/wallet-recipe';
import {
  RECIPE_CHARSET_V1,
  RECIPE_DOMAIN_V1,
  RECIPE_LENGTH_V1,
  RECIPE_REJECTION_LIMIT_V1,
} from './constants';

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DOMAIN_HEX = stringToHex(RECIPE_DOMAIN_V1);

export type RecipeDerivationTraceV1 = {
  wallet: Address;
  address20Hex: Hex;
  firstBlock: Hex;
  rejectedByteCount: number;
  consumedByteCount: number;
  blocksUsed: number;
  recipe: RecipeV1;
};

export function normalizeOriginWallet(input: string): Address {
  if (!ADDRESS_PATTERN.test(input)) {
    throw new Error('origin wallet 必须是 0x 开头的 20-byte EVM 地址');
  }
  const lowercase = input.toLowerCase() as Address;
  if (lowercase === ZERO_ADDRESS) {
    throw new Error('origin wallet 不允许零地址');
  }
  return getAddress(lowercase);
}

export function assertRecipeV1(recipe: string): asserts recipe is RecipeV1 {
  if (recipe.length !== RECIPE_LENGTH_V1) {
    throw new Error(`recipe v1 必须恰好为 ${RECIPE_LENGTH_V1} 位`);
  }
  for (const key of recipe) {
    if (!RECIPE_CHARSET_V1.includes(key)) {
      throw new Error(`recipe v1 含非法字符：${key}`);
    }
  }
}

function recipeBlock(wallet: Address, counter: number): Hex {
  if (!Number.isInteger(counter) || counter < 0 || counter > 0xffff_ffff) {
    throw new Error('recipe counter 超出 uint32 范围');
  }
  // 💭 为什么不用字符串拼接：地址必须以原始 20 bytes 参与哈希，counter 也必须是 uint32 大端。
  return keccak256(
    concatHex([DOMAIN_HEX, wallet.toLowerCase() as Hex, numberToHex(counter, { size: 4 })]),
  );
}

export function deriveRecipeV1Trace(walletInput: Address): RecipeDerivationTraceV1 {
  const wallet = normalizeOriginWallet(walletInput);
  let counter = 0;
  let rejectedByteCount = 0;
  let consumedByteCount = 0;
  let firstBlock: Hex | null = null;
  let recipe = '';

  while (recipe.length < RECIPE_LENGTH_V1) {
    const block = recipeBlock(wallet, counter);
    firstBlock ??= block;
    for (const byte of hexToBytes(block)) {
      consumedByteCount += 1;
      if (byte >= RECIPE_REJECTION_LIMIT_V1) {
        rejectedByteCount += 1;
        continue;
      }
      recipe += RECIPE_CHARSET_V1[byte % RECIPE_CHARSET_V1.length];
      if (recipe.length === RECIPE_LENGTH_V1) break;
    }
    counter += 1;
  }

  assertRecipeV1(recipe);
  return {
    wallet,
    address20Hex: wallet.toLowerCase() as Hex,
    firstBlock: firstBlock as Hex,
    rejectedByteCount,
    consumedByteCount,
    blocksUsed: counter,
    recipe,
  };
}

export function deriveRecipeV1(wallet: Address): RecipeV1 {
  return deriveRecipeV1Trace(wallet).recipe;
}

export function collectRecipeKeys(recipe: string): string[] {
  assertRecipeV1(recipe);
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const key of recipe) {
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function calculateRecipeDurationMs(
  recipe: string,
  manifest: ClipManifestV1,
): number {
  assertRecipeV1(recipe);
  const durations = new Map(manifest.clips.map((clip) => [clip.key, clip.durationMs]));
  const total = [...recipe].reduce((sum, key) => {
    const durationMs = durations.get(key);
    if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error(`manifest 缺少 recipe key ${key} 的合法 durationMs`);
    }
    return sum + durationMs;
  }, 0);
  // manifest 最细到 6 位小数；统一舍入消除 IEEE-754 连加产生的尾数漂移。
  return Math.round(total * 1_000_000) / 1_000_000;
}

export function hashRecipeV1(recipe: string): Hex {
  assertRecipeV1(recipe);
  return keccak256(stringToHex(recipe));
}
