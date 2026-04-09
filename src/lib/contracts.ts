/**
 * 合约地址 + 最小 ABI 子集
 * Phase 0 只需要 mint 函数的签名
 */

export const MATERIAL_NFT_ADDRESS = process.env
  .NEXT_PUBLIC_MATERIAL_NFT_ADDRESS as `0x${string}`;

// ERC1155PresetMinterPauser 的 mint 函数签名
export const MATERIAL_NFT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;
