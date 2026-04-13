-- Phase 4 S6：空投接收者表
-- 按 wallet_address 而非 user_id 分配（站外地址也能领空投）

create table airdrop_recipients (
  id              uuid primary key default gen_random_uuid(),
  round_id        uuid not null references airdrop_rounds(id),
  wallet_address  text not null,
  user_id         uuid references users(id),
  token_id        integer,
  tx_hash         text,
  status          text not null default 'pending'
                  check (status in ('pending', 'minting', 'success', 'failed')),
  created_at      timestamptz not null default now(),
  unique (round_id, wallet_address)
);
