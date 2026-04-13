/**
 * 空投系统类型定义 — Phase 4 S6
 */

export interface AirdropRound {
  id: string;
  round: number;
  title: string;
  audio_url: string | null;
  ar_tx_id: string | null;
  status: "draft" | "ready" | "distributing" | "done";
  created_at: string;
}

export interface AirdropRecipient {
  id: string;
  round_id: string;
  wallet_address: string;
  user_id: string | null;
  token_id: number | null;
  tx_hash: string | null;
  status: "pending" | "minting" | "success" | "failed";
  created_at: string;
}

/** POST /api/airdrop/trigger 请求体 */
export interface TriggerAirdropRequest {
  round: number;
  title: string;
}
