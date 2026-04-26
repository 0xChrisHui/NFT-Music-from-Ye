import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';

/**
 * 链上 step 共用的 helper：解析 ScoreNFT mint receipt 拿 tokenId
 * Phase 6 A1 拆 steps-chain.ts 时分出来
 */

export const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export type ReceiptLog = {
  address: string;
  topics: readonly `0x${string}`[];
};

/**
 * 从 mint tx receipt 的 logs 里抽 tokenId（topic[3] 是 to 地址，
 * 但 ERC721 Transfer 的第 4 个 topic 是 tokenId）。
 * 只信 SCORE_NFT_ADDRESS 出的 Transfer，避免 Orchestrator 内部其他 event 误匹配。
 */
export function extractTokenIdFromLogs(logs: readonly ReceiptLog[]): number {
  const matches = logs.filter(
    (l) =>
      l.topics.length >= 4 &&
      l.topics[0] === TRANSFER_TOPIC &&
      l.address.toLowerCase() === SCORE_NFT_ADDRESS.toLowerCase(),
  );
  if (matches.length === 0) {
    throw new Error('Transfer event not found in receipt');
  }
  return Number(BigInt(matches[0].topics[3]));
}
