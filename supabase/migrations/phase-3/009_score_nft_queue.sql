-- Phase 3 S5.a：score_nft_queue 表（乐谱 NFT 铸造队列，5 步状态机）
-- 在 Supabase Dashboard → SQL Editor 粘贴执行

create table if not exists score_nft_queue (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references users (id),
  pending_score_id  uuid not null references pending_scores (id),
  track_id          uuid not null references tracks (id),
  cover_ar_tx_id    text not null,
  events_ar_tx_id   text,           -- cron: uploading_events 后回填
  metadata_ar_tx_id text,           -- cron: uploading_metadata 后回填
  token_id          integer,        -- cron: minting_onchain 后回填（链上自增 id）
  token_uri         text,           -- ar:// metadata 地址
  status            text not null default 'pending'
                    check (status in (
                      'pending',            -- API 入队完成
                      'uploading_events',   -- cron: 上传 events.json
                      'minting_onchain',    -- cron: 链上 mint
                      'uploading_metadata', -- cron: 生成+上传 metadata
                      'setting_uri',        -- cron: setTokenURI
                      'success',
                      'failed'
                    )),
  retry_count       integer not null default 0,
  last_error        text,
  tx_hash           text,           -- 链上 tx hash，幂等恢复靠这个
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- cron 抢单索引：按 status + created_at 走
create index if not exists idx_score_queue_status_created
  on score_nft_queue (status, created_at);

-- 限流查询索引：按 user_id + created_at
create index if not exists idx_score_queue_user_created
  on score_nft_queue (user_id, created_at desc);

-- 一个 pending_score 只能入队一次（防重复铸造）
create unique index if not exists uq_score_queue_pending_score
  on score_nft_queue (pending_score_id);
