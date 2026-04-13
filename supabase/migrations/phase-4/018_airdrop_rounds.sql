-- Phase 4 S6：空投轮次表
-- 每 36 首曲目触发一轮空投，一共 3 轮（36/72/108）

create table airdrop_rounds (
  id          uuid primary key default gen_random_uuid(),
  round       integer not null unique,
  title       text not null,
  audio_url   text,
  ar_tx_id    text,
  status      text not null default 'draft'
              check (status in ('draft', 'ready', 'distributing', 'done')),
  created_at  timestamptz not null default now()
);
