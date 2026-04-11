-- Phase 0 最小表结构
-- 在 Supabase Dashboard → SQL Editor 粘贴执行

-- 启用 UUID 生成函数
create extension if not exists "uuid-ossp";

-- ========== users ==========
create table users (
  id              uuid primary key default uuid_generate_v4(),
  evm_address     text not null unique,
  privy_user_id   text not null unique,
  created_at      timestamptz not null default now()
);

-- 按 evm_address 查用户（登录后写入/查询）
create index idx_users_evm_address on users (evm_address);

-- ========== mint_queue ==========
create table mint_queue (
  id              uuid primary key default uuid_generate_v4(),
  idempotency_key text not null unique,
  user_id         uuid not null references users (id),
  mint_type       text not null default 'material',
  token_id        integer not null,
  status          text not null default 'pending',
  retry_count     integer not null default 0,
  tx_hash         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- cron 处理器按 status 取 pending 记录
create index idx_mint_queue_status on mint_queue (status);

-- 幂等检查：同一个 idempotency_key 不重复入队
-- （unique 约束已自动创建索引，不需要额外加）
