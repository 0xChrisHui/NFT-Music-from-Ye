-- Phase 3 S5.a：mint_score_enqueue 事务 RPC
-- 原子操作：限流检查 + 验证草稿 + 分配封面 + 入队 + 标记草稿 expired
--
-- 这是 Phase 2.5 延后的事务化 score 入队的真正兑现——封面分配用
-- FOR UPDATE SKIP LOCKED 必须在事务内才有意义。
--
-- 错误通过 raise exception 抛出，消息前缀标记类型：
--   RATE_LIMITED   → HTTP 429 (每小时 > 5 次)
--   INVALID_SCORE  → HTTP 400 (草稿不存在/状态错/不属于用户)
--   COVER_POOL_EMPTY → HTTP 503 (封面池空，运营问题)

create or replace function mint_score_enqueue(
  p_user_id uuid,
  p_pending_score_id uuid
)
returns table (
  queue_id uuid,
  cover_ar_tx_id text
)
language plpgsql
as $$
declare
  v_rate_count integer;
  v_track_id uuid;
  v_draft_status text;
  v_draft_user_id uuid;
  v_cover_id uuid;
  v_cover_ar_tx_id text;
  v_queue_id uuid;
begin
  -- 1. 限流：过去 1 小时同一用户 ≤ 5 条
  select count(*) into v_rate_count
  from score_nft_queue
  where user_id = p_user_id
    and created_at > now() - interval '1 hour';

  if v_rate_count >= 5 then
    raise exception 'RATE_LIMITED: max 5 score mints per hour (current=%)', v_rate_count;
  end if;

  -- 2. 验证 pending_score 存在 + 是 draft + 属于用户
  select track_id, status, user_id
  into v_track_id, v_draft_status, v_draft_user_id
  from pending_scores
  where id = p_pending_score_id;

  if v_track_id is null then
    raise exception 'INVALID_SCORE: pending_score not found (id=%)', p_pending_score_id;
  end if;

  if v_draft_user_id != p_user_id then
    raise exception 'INVALID_SCORE: pending_score does not belong to user';
  end if;

  if v_draft_status != 'draft' then
    raise exception 'INVALID_SCORE: pending_score status=% (expected draft)', v_draft_status;
  end if;

  -- 3. 分配封面：最少使用优先 + SKIP LOCKED（复用池语义）
  -- S5 硬门槛：ORDER BY usage_count ASC 让 100 张封面循环用，不是耗材
  select id, ar_tx_id
  into v_cover_id, v_cover_ar_tx_id
  from score_covers
  order by usage_count asc, created_at asc
  limit 1
  for update skip locked;

  if v_cover_id is null then
    raise exception 'COVER_POOL_EMPTY: no available cover (check score_covers table)';
  end if;

  -- 4. 封面 usage_count + 1
  update score_covers
  set usage_count = usage_count + 1
  where id = v_cover_id;

  -- 5. 写 score_nft_queue
  insert into score_nft_queue (
    user_id,
    pending_score_id,
    track_id,
    cover_ar_tx_id,
    status
  )
  values (
    p_user_id,
    p_pending_score_id,
    v_track_id,
    v_cover_ar_tx_id,
    'pending'
  )
  returning id into v_queue_id;

  -- 6. 标记 pending_score 为 expired（草稿消费）
  --    status 迁移：draft → expired，表示"已被正式铸造消费掉"
  update pending_scores
  set status = 'expired',
      updated_at = now()
  where id = p_pending_score_id;

  -- 7. 返回
  return query select v_queue_id, v_cover_ar_tx_id;
end;
$$;
