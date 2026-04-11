-- Phase 3 S5.a：扩展 mint_events 表存 ScoreNFT 数据
-- 为什么：mint_events 是 Phase 1 为 MaterialNFT 设计的，字段只够素材 NFT 用。
-- ScoreNFT 需要额外的自包含字段（score_data、metadata_ar_tx_id、score_queue_id）
-- 让个人页 /me 能直接从 mint_events 读到乐谱展示所需的一切，不需要再查 queue。
--
-- score_data 是 Phase 3 S6 数据主路径：mint_events.score_data (DB 内自包含) →
-- 灾备路径才走链上 tokenURI → Arweave metadata → events.json

alter table mint_events
  add column if not exists score_data jsonb,
  add column if not exists score_nft_token_id integer,
  add column if not exists metadata_ar_tx_id text,
  add column if not exists score_queue_id uuid references score_nft_queue(id);

-- S6 /score/[tokenId] 页面会按 score_nft_token_id 查
create index if not exists idx_mint_events_score_token
  on mint_events (score_nft_token_id)
  where score_nft_token_id is not null;

-- /me 页面按 user_id + kind 过滤：ScoreNFT vs MaterialNFT
-- 区分方式：score_queue_id IS NOT NULL → ScoreNFT，否则 → MaterialNFT
create index if not exists idx_mint_events_user_score_queue
  on mint_events (user_id, score_queue_id);
