# Track A — 铸造链路稳定性

> **范围**：ScoreNFT cron 四连 + material failed 重试 + 链上事件同步事务性 +
> 草稿保存原子化 + /score 链上灾备 + 我的乐谱按 owner 投影
>
> **前置**：无 — Track A 纯后端/DB，不依赖 UI / tester 反馈
>
> **对应 findings**：#1 #3 #17 #18 #19 #21 #22（共 7 项，其中 #17 + #18 合并为 A1）
>
> **核心交付物**：素材 + ScoreNFT + 链上事件三条后端链路全部达到"tester 公开 + 未来主网"的恢复语义标准

---

## 冻结决策

### D-A1 — 所有 cron 接入 Durable Lease 模式

所有会触发链上交易的 cron 都改成 `claim + lease(expires_at) + heartbeat` 模式。事务外别的 cron 实例抢不到同一 job，直到 lease 过期或主动释放。详见概念词典 `docs/LEARNING.md` "Durable Lease"。

### D-A2 — "tx 已发 DB 未落"一律标 failed，人工核查

后端 cron 里所有链上 writeContract 之后的 DB 写失败**一律不 reset**。改为：
- 日志 CRITICAL 标记 tx_hash + job id
- status = failed，在 last_error 记"tx 已发但 DB 失败，人工核查 operator tx 历史"
- 人工按日志去 Etherscan 找 tx，决定手动补 DB / 作废

### D-A3 — receipt pending ≠ failed

`getTransactionReceipt` 抛错（tx 未被 RPC 返回）不算失败。返回 null 等下次 cron。retry_count 不增加。只有 receipt.status = 'reverted' 或其他显式链上失败才算失败。

---

## 📋 Step 总览

| Step | Findings | 内容 | 工作量 | 依赖 |
|---|---|---|---|---|
| [A1](#step-a1--scorenft-cron-恢复语义重做) | #17 #18 | ScoreNFT cron 四连（post-send + durable lease + receipt pending + setTokenURI 拆步）| 1 天 | 无 |
| [A2](#step-a2--material-failed-重试语义pre-tester-gate) | #1 | material failed job 允许重试 / 明确返错 | 30-60 分 | 无（**Pre-tester**）|
| [A3](#step-a3--sync-chain-events-cursor-事务性) | #3 | 单条 upsert 失败不推进 cursor，或完整事务 | 30-60 分 | 无 |
| [A4](#step-a4--草稿保存原子化) | #19 | pending_scores 先 expired 再 insert 合并进 RPC | 1 小时 | 无 |
| [A5](#step-a5--scoretokenid-链上灾备路径) | #21 | DB miss 时从 tokenURI 读 Arweave metadata + events | 半天 | 无 |
| [A6](#step-a6--我的乐谱按-owner-投影) | #22 | /api/me/score-nfts 从 chain_events 算当前 owner | 半天 | A3 |

---

## Step A1 — ScoreNFT cron 恢复语义重做

**合并 finding #17 + #18，4 个子改动一次到位。**

### 概念简报
ScoreNFT cron 现在有 4 个后端幂等/恢复缺口，tester 踩到草稿铸造按钮时会集中暴露：
1. post-send rollback（tx 已发 DB 写失败 → reset → 重发）
2. claim RPC 只有事务瞬时锁（别的 cron 可抢同行）
3. receipt pending 被当失败（孤儿 NFT）
4. setTokenURI 未拆 uri_tx_hash（Vercel 10s 超时 / 重发同 URI）

### 📦 范围
- `app/api/cron/process-score-queue/steps-chain.ts`（`stepMintOnchain` + `stepSetTokenUri` 重写）
- `supabase/migrations/phase-6/021_score_nft_queue_lease.sql`（新建）
- `supabase/migrations/phase-6/022_score_nft_queue_uri_tx_hash.sql`（新建）
- `supabase/migrations/phase-6/023_claim_score_queue_durable_lease.sql`（新建 — 替换 `phase-3/hotfix/015_claim_score_queue_rpc.sql`）
- `src/types/jam.ts`（ScoreMintQueueRow 新增 `locked_at / uri_tx_hash` 字段）

### 做什么

**1. DB：加 lease 字段 + uri_tx_hash 字段**

`021_score_nft_queue_lease.sql`：
```sql
alter table score_nft_queue
  add column locked_at timestamptz,
  add column lease_expires_at timestamptz;

create index idx_score_nft_queue_lease on score_nft_queue (lease_expires_at)
  where lease_expires_at is not null;
```

`022_score_nft_queue_uri_tx_hash.sql`：
```sql
alter table score_nft_queue add column uri_tx_hash text;
```

**2. claim_score_queue_job RPC 改写为 Durable Lease**

`023_claim_score_queue_durable_lease.sql`：
- 原来：`FOR UPDATE SKIP LOCKED` + `update updated_at`
- 改为：`FOR UPDATE SKIP LOCKED` + `update locked_at = now(), lease_expires_at = now() + interval '5 minutes'`
- 查询条件额外加：`lease_expires_at is null or lease_expires_at < now()`（过期 lease 可被重新抢）

**3. stepMintOnchain 重写（post-send 分离 + receipt pending 兜底）**

```ts
// 无 tx_hash → 发 tx + 存 hash
if (!row.tx_hash) {
  let txHash: `0x${string}`;
  try {
    txHash = await operatorWalletClient.writeContract({...});
  } catch (err) {
    throw new Error(`chain send failed: ${err}`); // 外层 catch resetToPending
  }
  // tx 已广播 — 下面任何失败都不能 reset
  const { error: dbErr } = await supabaseAdmin
    .from('score_nft_queue')
    .update({ tx_hash: txHash, updated_at: now })
    .eq('id', row.id);
  if (dbErr) {
    console.error(`CRITICAL: score tx ${txHash} DB 写失败 job=${row.id}: ${dbErr.message}`);
    // 标 failed + last_error，不 reset
    await supabaseAdmin.from('score_nft_queue').update({
      status: 'failed',
      last_error: `CRITICAL post-send: tx ${txHash} DB write failed`,
    }).eq('id', row.id);
    return 'failed';
  }
  return 'minting_onchain'; // 保持状态，下次查 receipt
}

// 有 tx_hash → 查 receipt（pending 返 null 等下次）
let receipt;
try {
  receipt = await publicClient.getTransactionReceipt({ hash: row.tx_hash });
} catch {
  return 'minting_onchain'; // receipt 未出 — 不算失败
}
if (receipt.status !== 'success') {
  throw new Error(`tx reverted: ${row.tx_hash}`);
}
// ... 提取 tokenId 写 DB
return 'uploading_metadata';
```

**4. stepSetTokenUri 拆步**

改造为和 stepMintOnchain 相同的两阶段：
- 无 `uri_tx_hash` → 发 setTokenURI + 存 hash → 保持 `setting_uri` 状态
- 有 `uri_tx_hash` → 查 receipt（pending 返 null）→ 写 mint_events + 推 success

### 验证标准
- [ ] 3 条 migration 在 Supabase 执行完毕
- [ ] 模拟 DB 写失败后查日志 → CRITICAL + job status = failed（不 reset）
- [ ] 两个 cron 同时触发 → 只有一个拿到 lease，另一个 SKIP
- [ ] 手动发起一次乐谱铸造（scripts/）→ 走完 pending → success
- [ ] `scripts/verify.sh` 通过

---

## Step A2 — material failed 重试语义【Pre-tester Gate】

### 概念简报
现在 `POST /api/mint/material` 对同 `idempotency_key` 命中 failed job 会返回 `{result:"ok"}`，前端继续红心 UI 但后端不重新入队。tester 第一次收藏失败后永远卡 failed。

### 📦 范围
- `app/api/mint/material/route.ts`

### 做什么
23505 冲突后查出 existing row，按 status 分 3 种路径：
- `success` → 返 409 "已铸造"
- `pending / minting_onchain` → 返 200 复用
- **`failed` → 重置为 pending + retry_count 重置 / 或明确返 409 "上次铸造失败，请稍后再试"**

推荐行为：**重置**（用户点收藏的直觉就是"再来一次"）：
```ts
if (existing.status === 'failed') {
  await supabaseAdmin.from('mint_queue')
    .update({ status: 'pending', tx_hash: null, retry_count: 0 })
    .eq('id', existing.id);
  return NextResponse.json({ result: 'ok', mintId: existing.id, status: 'pending', retried: true });
}
```

### 验证标准
- [ ] 模拟一个 failed job → 再调 POST /api/mint/material → 返回 `retried: true` + job status 变 pending
- [ ] cron 下一轮取走重新 mint
- [ ] 前端爱心继续显示 success

---

## Step A3 — sync-chain-events cursor 事务性

### 概念简报
`sync-chain-events` 循环里 upsert 单条失败只打日志，然后仍推进 `last_synced_block`。一次 Supabase 抖动可能让某个 Transfer 永远漏扫，后续 owner 投影 / 空投快照会建在错误链上事实上。

### 📦 范围
- `app/api/cron/sync-chain-events/route.ts`

### 做什么
两种方案二选一：
- **方案 A（严格）**：任一 upsert 失败 → 立刻 return，不推进 cursor；下次 cron 从同一区块重试
- **方案 B（事务）**：把批处理包进 Supabase RPC（batch upsert + update cursor in transaction），保证原子

推荐方案 A（简单、侵入小）：
```ts
for (const event of events) {
  const { error } = await supabaseAdmin.from('chain_events').upsert(...);
  if (error) {
    console.error(`[sync] upsert failed at block ${event.blockNumber}, 停止推进 cursor:`, error);
    return NextResponse.json({ result: 'partial', stoppedAt: event.blockNumber });
  }
}
// 全部成功才推进 cursor
await supabaseAdmin.from('system_kv').update({ value: String(newCursor) }).eq('key', 'last_synced_block');
```

### 验证标准
- [ ] 手动造一条 upsert 冲突 → cursor 不前进
- [ ] 修复 upsert 后下轮 cron → cursor 推进
- [ ] `scripts/verify.sh` 通过

---

## Step A4 — 草稿保存原子化

### 概念简报
`POST /api/score/save` 先把旧 draft 标 `expired` 再插入新 draft。插入失败时旧草稿已失效，用户丢原本有效的创作。

### 📦 范围
- `app/api/score/save/route.ts`
- `supabase/migrations/phase-6/024_save_score_rpc.sql`（新建 RPC）

### 做什么
写一个 Supabase RPC `save_score_atomic(user_id, track_id, events_data, created_at)`：
- BEGIN
- UPDATE pending_scores SET status = 'expired' WHERE user_id + track_id AND status = 'draft'
- INSERT new draft
- COMMIT

route.ts 改为调用此 RPC。

### 验证标准
- [ ] 手动在 RPC 里 throw 一个错 → 旧 draft 仍保留 draft 状态（事务回滚）
- [ ] 正常路径：旧 draft → expired，新 draft 插入

---

## Step A5 — /score/[tokenId] 链上灾备路径

### 概念简报
ARCH 承诺"永久可复现"，但 `src/data/score-source.ts` 查不到 `mint_events` 就返 null。DB 丢数据 = 已上链 ScoreNFT 404。

### 📦 范围
- `src/data/score-source.ts`
- `src/lib/arweave/core.ts`（复用 `fetchFromArweave`）

### 做什么
DB 查不到时 fallback：
1. 链上查 `tokenURI(tokenId)` → 得到 `ar://{txId}`
2. `fetchFromArweave(txId)` 拿 metadata.json
3. 从 metadata 的 `animation_url` 提取 events_ar_tx_id → fetch events.json
4. 渲染页面

把这条降级路径加在 `getScoreSource(tokenId)` 里。

### 验证标准
- [ ] 手动删一条 mint_events 记录 → 页面仍可渲染（从链上读）
- [ ] 恢复 mint_events → 走回 DB 主路径（更快）

---

## Step A6 — 我的乐谱按 owner 投影

### 概念简报
`/api/me/score-nfts` 现在按 `score_nft_queue.user_id`（= 初始 mint 者）。ScoreNFT 转手后原用户还能看、接收者看不到。

### 📦 范围
- `app/api/me/score-nfts/route.ts`
- `chain_events` 表（已有）

### 做什么
查询改为：
```sql
SELECT score_nft_token_id, ... FROM chain_events
WHERE contract_address = SCORE_NFT_ADDRESS
  AND to_address = :user_evm_address
  AND NOT EXISTS (
    SELECT 1 FROM chain_events e2
    WHERE e2.token_id = chain_events.token_id
      AND e2.block_number > chain_events.block_number
  )
```
（最近一次 Transfer 的 to = 当前 owner）

### 依赖
Track A3 完成（chain_events 是准确的链上事实）。

### 验证标准
- [ ] ScoreNFT 转手给另一个用户 → 原 /me 不再显示，新 /me 显示
- [ ] 未转手的 ScoreNFT 正常显示在 minter 的 /me

---

## Track A 完结标准

- [ ] 6 steps 全绿
- [ ] 5 条 migration（021-024 + 替换 015 hotfix）Supabase 执行
- [ ] `scripts/verify.sh` 通过
- [ ] 端到端重测：手动铸造一次 ScoreNFT（scripts/）→ 走完整条 cron 链路
- [ ] 手动发起一次"模拟 post-send 失败"→ 日志 CRITICAL，job status failed
