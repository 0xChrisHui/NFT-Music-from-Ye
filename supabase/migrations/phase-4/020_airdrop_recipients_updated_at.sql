-- Phase 4 Review Fix F7: airdrop_recipients 加 updated_at
-- 用于 recoverStuck 超时判定（基于状态变更时间，不是创建时间）

alter table airdrop_recipients
  add column updated_at timestamptz not null default now();
