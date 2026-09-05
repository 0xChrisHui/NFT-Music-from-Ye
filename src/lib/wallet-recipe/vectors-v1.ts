import type { Address, Hex } from 'viem';
import type { RecipeV1 } from '@/src/types/wallet-recipe';

export type RecipeVectorV1 = {
  label: string;
  wallet: Address;
  address20Hex: Hex;
  firstBlock: Hex;
  rejectedByteCount: number;
  recipe: RecipeV1;
  durationMs: number;
};

// 这些值是跨语言实现的公开合同；修改任意一项都必须视为 recipe v2。
export const RECIPE_V1_TEST_VECTORS: readonly RecipeVectorV1[] = [
  {
    label: '最小非零地址',
    wallet: '0x0000000000000000000000000000000000000001',
    address20Hex: '0x0000000000000000000000000000000000000001',
    firstBlock: '0x2ed26ba6eee19e32341617a43c85f575abd32119ddb60101a17ef0f01819dd1b',
    rejectedByteCount: 0,
    recipe: 'K49WWJOOQWXUYZ3J157ZFCBBRSYYYZF1XROD' as RecipeV1,
    durationMs: 269900.020837,
  },
  {
    label: '重复 0x11 地址',
    wallet: '0x1111111111111111111111111111111111111111',
    address20Hex: '0x1111111111111111111111111111111111111111',
    firstBlock: '0x6e566e887408f419f505c27dc1d0159da957b8c4eb9c2339c405abbcff5d1f7c',
    rejectedByteCount: 1,
    recipe: 'COC2II2Z3FORN2VNZPEQTM9VQF1IV5QMIIW4' as RecipeV1,
    durationMs: 269899.958338,
  },
  {
    label: '混合数字地址',
    wallet: '0x1234567890AbcdEF1234567890aBcdef12345678',
    address20Hex: '0x1234567890abcdef1234567890abcdef12345678',
    firstBlock: '0x7acf508f05308abc2445373af1ccedd9b3c52b69d7c3756f69deda9bccf67138',
    rejectedByteCount: 0,
    recipe: 'O1I9FM4IA7TWZYVB9RH79PJD7GCLY4FU9S85' as RecipeV1,
    durationMs: 269900.104169,
  },
  {
    label: '最大地址',
    wallet: '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF',
    address20Hex: '0xffffffffffffffffffffffffffffffffffffffff',
    firstBlock: '0xaf4f39638e773a2c82919b4c2872a1658ef57da859540f577bda736b1b98d491',
    rejectedByteCount: 0,
    recipe: '5HV18LWIWBLEEGR383RYRMPPPCH91I6BB0AI' as RecipeV1,
    durationMs: 269900.000004,
  },
  {
    label: 'OP Sepolia 当前 operator',
    wallet: '0x306D3A445b1fc7a789639fa9115e308a34231633',
    address20Hex: '0x306d3a445b1fc7a789639fa9115e308a34231633',
    firstBlock: '0xdbb65737127e7dcc1e5e0684c9f869fc86340731bfba665c866d2c6066d27367',
    rejectedByteCount: 1,
    recipe: 'DCPTSSRY4WGYV670QHNLG4U0BIY44H50LYNR' as RecipeV1,
    durationMs: 269900.062503,
  },
  {
    label: 'OP Sepolia 历史 operator',
    wallet: '0x40d36fd4a855d5d23e0F04B7fD89285f2eDe116B',
    address20Hex: '0x40d36fd4a855d5d23e0f04b7fd89285f2ede116b',
    firstBlock: '0xa3336217ffa7ca7a7b0c8135433516e21552787d40f13fc2b305f82ffd6570c5',
    rejectedByteCount: 2,
    recipe: 'TP0XXWOPMVR5RWKVKMR2Z1O9F6L3ER4E470T' as RecipeV1,
    durationMs: 269900.020837,
  },
  {
    label: 'OP Mainnet Score #1 owner',
    wallet: '0x19da4b170dF5CcA47414b04f04a24f67E2E6bA54',
    address20Hex: '0x19da4b170df5cca47414b04f04a24f67e2e6ba54',
    firstBlock: '0xdc59463fd937becac627776958d85f13fcc302c9888e080696f095157bea7fe0',
    rejectedByteCount: 1,
    recipe: 'ER81BTKWSDL7QAXTPCV28IGGYFVPSTIERCMR' as RecipeV1,
    durationMs: 269900.000004,
  },
  {
    label: 'OP Mainnet Score #2 owner',
    wallet: '0xFD869d82A64e51cb488631fe25A46f9DBe417f20',
    address20Hex: '0xfd869d82a64e51cb488631fe25a46f9dbe417f20',
    firstBlock: '0x1252e63b1d47dc8bcdb62ab783c48c730677c712486a8816a1d56725b8c98790',
    rejectedByteCount: 0,
    recipe: 'SKOX39E5ZCGDXQ6HGLTSA82WR75BEV1A18Q9' as RecipeV1,
    durationMs: 269899.937505,
  },
];
