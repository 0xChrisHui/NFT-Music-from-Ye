/**
 * 合奏相关共享类型 — Track A / Track B / Track C 共用
 * 改这个文件前所有线必须对齐
 *
 * 冻结的 API 端点命名：
 *   GET  /api/sounds                → SoundsListResponse
 *   POST /api/score/save            → SaveScoreResponse
 *   GET  /api/scores/[id]/preview   → ScorePreviewResponse
 *   GET  /api/me/scores             → MyScoresResponse
 */

/** sounds 表的一行 — 26 个键盘音效之一 */
export interface Sound {
  id: string;
  /** tokenId 109-134 */
  token_id: number;
  /** 音效名称（如 "Kick", "Snare", "Bell"） */
  name: string;
  /** 本地路径或 Arweave URL */
  audio_url: string;
  /** 时长（毫秒） */
  duration_ms: number;
  /** 分类 */
  category: 'percussion' | 'melody' | 'effect';
  /** 对应键盘键（a-z） */
  key: string;
}

/** 单次按键事件 */
export interface KeyEvent {
  /** 按的键（a-z） */
  key: string;
  /** 距离录制开始的时间（毫秒） */
  time: number;
  /** 按键持续时间（毫秒） */
  duration: number;
}

/** pending_scores 表的一行 — 合奏草稿（状态机表，禁止 DELETE） */
export interface PendingScore {
  id: string;
  user_id: string;
  track_id: string;
  /** 按键事件序列 */
  events_data: KeyEvent[];
  /** draft = 有效草稿，expired = 已过期（不删除，标记状态） */
  status: 'draft' | 'expired';
  created_at: string;
  updated_at: string;
  /** 24h 后过期 */
  expires_at: string;
}

/** API 响应：GET /api/sounds */
export interface SoundsListResponse {
  sounds: Sound[];
}

/** API 请求体：POST /api/score/save */
export interface SaveScoreRequest {
  trackId: string;
  eventsData: KeyEvent[];
  /** 创作时间（ISO 字符串），服务端按此计算 24h TTL，超过 24h 拒绝 */
  createdAt: string;
}

/** API 响应：POST /api/score/save */
export interface SaveScoreResponse {
  result: 'ok';
  scoreId: string;
  expiresAt: string;
}

/** API 响应：GET /api/scores/[id]/preview */
export interface ScorePreviewResponse {
  score: {
    trackId: string;
    eventsData: KeyEvent[];
    expiresAt: string;
  };
}

/** API 响应：GET /api/me/scores */
export interface MyScoresResponse {
  scores: {
    id: string;
    trackTitle: string;
    /** 该用户对同一曲目的第几次创作 */
    seq: number;
    /** 音符数量 */
    eventCount: number;
    createdAt: string;
    expiresAt: string;
  }[];
}

// ─────────────────────────────────────────────────
// Phase 3 S5 — ScoreNFT 铸造队列 + metadata
// ─────────────────────────────────────────────────

/** score_nft_queue 5 步状态机 */
export type ScoreMintStatus =
  | 'pending'
  | 'uploading_events'
  | 'minting_onchain'
  | 'uploading_metadata'
  | 'setting_uri'
  | 'success'
  | 'failed';

/** score_nft_queue 表的一行 */
export interface ScoreMintQueueRow {
  id: string;
  user_id: string;
  pending_score_id: string;
  track_id: string;
  cover_ar_tx_id: string;
  events_ar_tx_id: string | null;
  metadata_ar_tx_id: string | null;
  token_id: number | null;
  token_uri: string | null;
  status: ScoreMintStatus;
  retry_count: number;
  last_error: string | null;
  tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

/** OpenSea ERC-721 metadata 标准
 *  S5 cron 在 uploading_metadata 阶段生成并上传 Arweave */
export interface ScoreMetadata {
  name: string;
  description: string;
  /** ar:// 或 https://arweave.net/... 指向封面 */
  image: string;
  /** ripples.app/score/[tokenId] */
  external_url?: string;
  /** decoder.html + URL 参数 = 网页唱片机 */
  animation_url: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

/** 个人页用：用户铸造的 ScoreNFT 概要 */
export interface OwnedScoreNFT {
  tokenId: number;
  trackTitle: string;
  coverUrl: string;
  eventCount: number;
  txHash: string;
  mintedAt: string;
}

/** API 响应：GET /api/me/score-nfts */
export interface MyScoreNFTsResponse {
  scoreNfts: OwnedScoreNFT[];
}

/** API 请求体：POST /api/mint/score */
export interface MintScoreRequest {
  pendingScoreId: string;
}

/** API 响应：POST /api/mint/score */
export interface MintScoreResponse {
  queueId: string;
  coverArTxId: string;
  coverUrl: string;
}
