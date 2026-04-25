# Track D — 空投闭环（条件性）

> **范围**：快照新鲜度 + cron 串行 + 触发事务 + admin header 鉴权 +
> failed round 判定 + AirdropNFT metadata
>
> **前置**：**D1 产品决策** — 主网是否做空投？决策结果决定后续 5 个 step 做不做
>
> **对应 findings**：#4 #5 #10 #11 #12 #25（共 6 项）
>
> **核心交付物**：要么做完整空投闭环（可承诺奖励 NFT 主网展示），要么明确挂起并关闭代码入口

---

## 冻结决策

### D-D1 — 空投是否进主网是产品决策

当前状态：
- Phase 4C 做了空投合约 + cron 骨架
- 2 轮 CTO review 都指出 AirdropNFT metadata 没做 + cron 串行性 + admin 鉴权等深层问题
- 修全套 = 1 周左右
- 主网不做 = 所有代码保留但关闭入口，未来某阶段再做

决策逻辑：
- **做** → D2-D6 全修 + 主网发奖励
- **不做** → D2 单做（admin header 鉴权，避免泄露点）+ STATUS/ARCH 明确"空投代码挂起，主网不对外承诺"

**默认假设**：若用户未明确说"做"，视为不做。只修 D2。

### D-D2 — 空投一旦启用，必须串行运营钱包交易

空投 cron 独立于 material mint cron 和 score mint cron，但共用同一个 `operatorWalletClient`。现在三个 cron 可能同一分钟都有活跃任务 → 并发发 tx → nonce race。

解决方案（Phase 6 选其一）：
- **选项 A**：Redis 分布式锁（新增 Upstash key "op_wallet_lock"，所有 cron 入口先 acquireLock）
- **选项 B**：专用调度 cron（只有一个 cron 知道所有队列，按优先级轮流处理）

推荐选项 A（侵入最小）。

### D-D3 — AirdropNFT metadata 生成是和 ScoreNFT 同等级别的链路

要做就按 ScoreNFT 的模式：上传 metadata 到 Arweave → setTokenURI。不是一句 mint 完事。

---

## 📋 Step 总览

| Step | Findings | 内容 | 条件 | 工作量 |
|---|---|---|---|---|
| [D1](#step-d1--产品决策gate) | — | 决定主网是否做空投 | 无 | 5 分钟讨论 |
| [D2](#step-d2--admin-header-鉴权) | #11 | /api/airdrop/trigger 从 query token 改 Authorization | **不管 D1 怎么定都做** | 30 分钟 |
| [D3](#step-d3--快照新鲜度--触发事务) | #4 #10 | trigger 检查 chain_events cursor + 3 步合并事务 | D1 = 做 | 半天 |
| [D4](#step-d4--运营钱包全局串行锁) | #5 | Redis 分布式锁或调度 cron | D1 = 做 | 半天 |
| [D5](#step-d5--failed-round-判定--health--告警) | #12 | round 不因 failed recipient 被标 done + health 暴露指标 | D1 = 做 | 半天 |
| [D6](#step-d6--airdropnft-metadata) | #25 | metadata 生成 + setTokenURI 链路 | D1 = 做 | 1-2 天 |

---

## Step D1 — 产品决策【Gate】

### 概念简报
空投不是技术可选项，是产品决策。和用户讨论：
1. 主网上线时是否做空投？
2. 如果做，奖励对象是什么？（Phase 4 原设计：前 N 个素材收藏者、周年纪念等）
3. metadata 长什么样？

### 📦 范围
- 讨论 + 决策记录
- 更新 `docs/JOURNAL.md` 2026-04-XX 条目

### 产出
在 JOURNAL 写一条决策：
> **Phase 6 D1 — 主网是否做空投**
> 决定：做 / 不做
> 理由：...
> 影响：
> - 做 → Track D D2-D6 全推进
> - 不做 → 只 D2，其余挂起；STATUS / ARCH 明确"空投代码挂起"

### 验证标准
- [ ] JOURNAL 记录决策
- [ ] 若不做，更新 STATUS.md "tester 范围"段落
- [ ] 若做，往下开 D3-D6

---

## Step D2 — admin header 鉴权【无条件做】

### 概念简报
`app/api/airdrop/trigger/route.ts:9, 18-20` 从 `?token=` 读 `ADMIN_TOKEN`。query token 会进浏览器历史、Vercel/代理日志、截图和复制链接，泄露面大。这个接口能创建空投轮次并间接消耗运营钱包，**即使空投不启用也不能留这个泄露点**。

### 📦 范围
- `app/api/airdrop/trigger/route.ts`
- `src/lib/auth/admin-auth.ts`（新建，复用 cron-auth 模式）

### 做什么

**1. 新建 admin-auth.ts**
```ts
import "server-only";

export function verifyAdminToken(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7) === expected;
  }
  return false; // 不再接受 query param
}
```

**2. trigger 路由替换**
```ts
if (!verifyAdminToken(req)) {
  return NextResponse.json({ error: '无效的 admin token' }, { status: 401 });
}
```

### 注意
如果有 runbook 或运维工具在调这个接口，要同步改（告知用户）。

### 验证标准
- [ ] `?token=xxx` 访问 → 401
- [ ] `Authorization: Bearer xxx` → 正常工作
- [ ] `scripts/verify.sh` 通过

---

## Step D3 — 快照新鲜度 + 触发事务

### 概念简报
两个问题合并：
- **#4**：`airdrop/trigger` 从 `chain_events` 算当前 owner，但没检查 `system_kv.last_synced_block` 是否接近 `latest block`。如果同步任务落后 100 区块，空投就不是"当前持有者"
- **#10**：触发按 "插入 round → 插入 recipients → 标记 ready" 三步非事务。中途失败留下 draft round，再次触发 409 冲突，只能人工修库

### 📦 范围
- `app/api/airdrop/trigger/route.ts`
- `supabase/migrations/phase-6/025_airdrop_trigger_rpc.sql`（新建）

### 做什么

**1. 新鲜度门槛**
```ts
const { data: cursor } = await supabase.from('system_kv')
  .select('value').eq('key', 'last_synced_block').single();
const latest = await publicClient.getBlockNumber();
const gap = Number(latest) - Number(cursor.value);
if (gap > 10) {
  return NextResponse.json({
    error: `链上事件同步落后 ${gap} 区块，拒绝触发空投`,
    hint: '等 sync-chain-events cron 追上后重试',
  }, { status: 503 });
}
```

**2. 合并三步成 RPC**
`025_airdrop_trigger_rpc.sql`：
```sql
create or replace function trigger_airdrop_round(
  round_name text,
  recipients jsonb  -- [{wallet_address, user_id}]
) returns uuid as $$
declare new_round_id uuid;
begin
  insert into airdrop_rounds (name, status) values (round_name, 'draft') returning id into new_round_id;
  insert into airdrop_recipients (round_id, wallet_address, user_id)
    select new_round_id, r->>'wallet_address', (r->>'user_id')::uuid from jsonb_array_elements(recipients) r;
  update airdrop_rounds set status = 'ready' where id = new_round_id;
  return new_round_id;
end;
$$ language plpgsql;
```

### 验证标准
- [ ] 手动滞后 cursor 20 区块 → trigger 返 503
- [ ] 模拟中间某步失败 → round 整体回滚，不留 draft
- [ ] 正常路径：round 从 draft 直接到 ready

---

## Step D4 — 运营钱包全局串行锁

### 概念简报
见 D-D2 决策。三个 cron（material / score / airdrop）共用 operatorWalletClient，同分钟活跃可 nonce race。

### 📦 范围
- `src/lib/chain/operator-lock.ts`（新建，基于 Upstash Redis）
- 三个 cron route 入口

### 做什么

**1. 锁模块**
```ts
// operator-lock.ts
import { Redis } from '@upstash/redis';
const redis = new Redis({...});
const LOCK_KEY = 'op_wallet_lock';
const LEASE_MS = 30_000;

export async function acquireOpLock(holder: string): Promise<boolean> {
  const result = await redis.set(LOCK_KEY, holder, { nx: true, px: LEASE_MS });
  return result === 'OK';
}

export async function releaseOpLock(holder: string) {
  // Lua 脚本保证只释放自己的锁
  await redis.eval(
    `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`,
    [LOCK_KEY], [holder]
  );
}
```

**2. 三个 cron 入口包装**
```ts
// process-mint-queue/route.ts
const holder = `mint-${crypto.randomUUID()}`;
if (!await acquireOpLock(holder)) {
  return NextResponse.json({ result: 'busy', holder: null });
}
try {
  // ... 原逻辑
} finally {
  await releaseOpLock(holder);
}
```

### 注意
锁失败不是错误，是"别的 cron 正在用 wallet"。Hobby cron 间隔 1 分钟，完全够用。

### 验证标准
- [ ] 模拟 3 个 cron 同时触发 → 只 1 个拿到锁，其余返 busy
- [ ] 锁过期后（30s）能被新 cron 接管
- [ ] `scripts/verify.sh` 通过

---

## Step D5 — failed round 判定 + health + 告警

### 概念简报
- `markRoundDoneIfComplete` 只看 pending/minting，不看 failed。有 failed recipient 也会 done
- `/api/health` 没有空投指标

### 📦 范围
- `app/api/cron/process-airdrop/route.ts`（`markRoundDoneIfComplete` 改判定）
- `app/api/health/route.ts`（新增 airdrop 字段）
- `src/types/tracks.ts`（HealthResponse 扩展）

### 做什么

**1. round 完成判定**
```ts
const { count: activeCount } = await supabase.from('airdrop_recipients')
  .select('id', { count: 'exact', head: true })
  .eq('round_id', roundId)
  .in('status', ['pending', 'minting']);
if ((activeCount ?? 0) > 0) return; // 仍有活跃

const { count: failedCount } = await supabase.from('airdrop_recipients')
  .select('id', { count: 'exact', head: true })
  .eq('round_id', roundId)
  .eq('status', 'failed');

const finalStatus = (failedCount ?? 0) > 0 ? 'done_with_failures' : 'done';
await supabase.from('airdrop_rounds').update({ status: finalStatus }).eq('id', roundId);
```

**2. health 加 airdrop 块**
```ts
{
  airdrop: {
    activeRounds: number,
    failedRecipients: number,
    oldestMintingAge: number, // 秒
  }
}
```

### 验证标准
- [ ] 造一个 round 有 1 failed + 0 active → status 走 done_with_failures 而非 done
- [ ] health 返回 airdrop 字段

---

## Step D6 — AirdropNFT metadata

### 概念简报
合约有 `setTokenURI` 但 cron 只调 `mint()`。tester / 主网拿到的是空壳 NFT — OpenSea 看不到图。

### 📦 范围
- `app/api/cron/process-airdrop/route.ts`
- `supabase/migrations/phase-6/026_airdrop_recipients_token_uri.sql`（加字段）
- `scripts/arweave/generate-airdrop-metadata.ts`（新建 — 预生成或动态）

### 做什么

**1. 决定 metadata 内容**
- 参考 Phase 4C 设计：`name`、`description`、`image`、轮次元信息
- 建议：每个 round 一张共享 image（Arweave 上一次上传）→ 每个 tokenId 可以共用一个 tokenURI 或独立生成

**2. cron 链路扩展**
当前 `trySendNew` 发 mint → 存 tx_hash → 下次查 receipt → 写 token_id + 标 success。

扩展为：
- 发 mint → 存 tx_hash
- 查 receipt → 写 token_id
- 上传 metadata（若 round 级别共享，只做一次）
- 调 setTokenURI → 存 uri_tx_hash
- 查 setTokenURI receipt → 标 success

类似 ScoreNFT cron 的 5 步状态机。

### 验证标准
- [ ] 测试网 mint 一张空投 NFT → OpenSea 可见名字 + 图
- [ ] 失败场景（metadata 上传失败 / setTokenURI 失败）不会重复 mint
- [ ] `forge test`（若合约层需改）+ `scripts/verify.sh` 全绿

---

## Track D 完结标准

### 若 D1 = 做
- [ ] D1-D6 全部 steps 完成
- [ ] 3 条 migration 执行（025 trigger RPC + 026 token_uri + 其他）
- [ ] 测试网端到端：trigger → recipient mint → metadata → setTokenURI → success
- [ ] OpenSea 可见空投 NFT 图和名字
- [ ] `scripts/verify.sh` 通过

### 若 D1 = 不做
- [ ] D2 完成（admin header 鉴权）
- [ ] STATUS.md "tester 范围" 明确"空投代码挂起"
- [ ] `docs/ARCHITECTURE.md` 空投章节加"Phase 6 决定不进主网"注解
- [ ] cron-job.org 停用 `process-airdrop` 定时（保留 URL，不触发）
