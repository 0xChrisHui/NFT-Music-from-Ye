# Findings — Phase 5 严格 CTO Review

日期：2026-04-25  
审查对象：当前 `HEAD` = `ddda82c`，工作区另有未跟踪的 `references/Bai/`、`references/semi-app/`、`references/semi-backend/`，本 review 不把这些未跟踪参考目录视为已交付代码。

## 本轮新增发现

### [P0] MaterialNFT 收藏入队不是原子唯一，同一用户同一素材可被并发请求重复入队并重复铸造

位置：`app/api/mint/material/route.ts:32-63`、`src/hooks/useFavorite.ts:45-47`、`supabase/migrations/phase-0-2/001_initial_minimal.sql:19-27`

`POST /api/mint/material` 先查 `mint_events`，再查 `mint_queue`，最后插入新 `idempotency_key`。这三步不在同一个数据库事务里，也没有 `(user_id, token_id)` 层面的唯一约束。前端还用 `Date.now()` 生成每次不同的 `idempotencyKey`，所以两个并发请求可以同时通过“尚未 queued / minted”的检查，各自插入 pending job。公开 tester 阶段这会直接变成同一用户同一首歌重复 sponsored mint，既破坏“收藏=一次铸造”的产品语义，也会消耗 operator gas。

### [P0] ScoreNFT 铸造 cron 的 post-send 恢复语义仍不安全，`tx_hash` 未落库时会重复发送 `mintScore`

位置：`app/api/cron/process-score-queue/steps-chain.ts:58-76`、`app/api/cron/process-score-queue/route.ts:98-109`、`supabase/migrations/phase-3/hotfix/015_claim_score_queue_rpc.sql:13-22`

`stepMintOnchain()` 在没有 `tx_hash` 时先发 `mintScore`，然后才写 `score_nft_queue.tx_hash`。如果交易已经广播但 DB 写入失败，函数直接 throw，外层 catch 只递增 `retry_count`，不会进入“链上状态未知，禁止重发”的保护状态。下一次 `claim_score_queue_job()` 仍会捞出 `minting_onchain` 且 `tx_hash = null` 的记录，`stepMintOnchain()` 会再次发送 `mintScore`。这和刚修过的 material / airdrop post-send bug 是同一类事故，但 ScoreNFT 链路还没收住。

### [P0] ScoreNFT 队列 RPC 只在 SQL 事务瞬间加锁，不能防止两个 cron 实例处理同一个活跃 job

位置：`supabase/migrations/phase-3/hotfix/015_claim_score_queue_rpc.sql:9-22`、`app/api/cron/process-score-queue/route.ts:37-40`、`app/api/cron/process-score-queue/steps-chain.ts:58-67`

`claim_score_queue_job()` 对 `pending / uploading_events / minting_onchain / uploading_metadata / setting_uri` 都只是 `update updated_at = now()` 后返回，并没有持久的 `locked_at / processing` lease，也没有把会产生副作用的步骤切到独占状态。`FOR UPDATE SKIP LOCKED` 只保护 SQL 这一次 update；事务结束后，另一个 cron 实例可以马上拿到同一行。最危险的是 `minting_onchain + tx_hash=null`：两个实例都可能进入 `writeContract(mintScore)`，造成双 mint。当前 `cron-job.org`、手动触发、Vercel 重试或慢请求重叠都可能触发这个路径。

### [P1] ScoreNFT receipt 未出现会被当成失败重试，可能把已广播交易标成 failed

位置：`app/api/cron/process-score-queue/steps-chain.ts:83-88`、`app/api/cron/process-score-queue/route.ts:98-109`

`publicClient.getTransactionReceipt()` 在交易还没被 RPC 返回时会抛错。这里没有像 `process-mint-queue` 那样把“receipt 还没出来”当作正常 pending，而是抛到外层，递增 `retry_count`，3 次后把 job 标成 `failed`。如果链上交易稍后成功，系统会得到一个没有 metadata、没有 `mint_events`、不会继续 `setTokenURI` 的孤儿 ScoreNFT。

### [P1] 运营钱包交易没有全局串行锁，三个 cron 端点可能同时用同一个 EOA 发交易

位置：`docs/CONVENTIONS.md:59-61`、`app/api/cron/process-mint-queue/route.ts:20-25`、`app/api/cron/process-score-queue/steps-chain.ts:58-67`、`app/api/cron/process-airdrop/route.ts:143-151`

项目规则明确禁止“同时发两笔运营钱包交易”。但当前 material mint、score mint、airdrop 是三个独立 cron 端点，各自直接调用同一个 `operatorWalletClient`。只要多个队列同一分钟有活跃任务，就可能并发取 nonce、互相替换交易或造成 RPC nonce error。Phase 5 的核心架构假设是“运营钱包串行队列”，当前实现只做到“单个端点内尽量串行”，没有做到全系统串行。

### [P1] 爱心 UI 在 API 入队成功前就永久显示成功，失败也不回退

位置：`src/hooks/useFavorite.ts:28-31`、`src/hooks/useFavorite.ts:70-72`、`src/components/FavoriteButton.tsx:22-29`、`docs/ARCHITECTURE.md:224-228`

`useFavorite()` 点击后立刻 `setStatus('success')` 并写本地 minted 缓存，随后才调用 `/api/mint/material`。如果接口 401、429、500、网络失败，catch 只打日志，不把红心回退，也不提示用户。架构文档要求“铸造失败 → idle + 提示收藏失败”，当前实现会让 tester 看到“收藏成功”，但 DB 里可能根本没有 job。

### [P2] `setTokenURI` 仍然是“发交易 + 等确认 + 写 DB”同次调用，未达到 Phase 5 D2 拆步标准

位置：`app/api/cron/process-score-queue/steps-chain.ts:115-131`、`playbook/phase-5-testnet-public.md:35-40`

Phase 5 D2 明确要求 `stepSetTokenUri` 也拆成“无 hash 只发并存 hash / 有 hash 只查 receipt”。当前代码没有 `uri_tx_hash` 字段，仍在同一次 Vercel Hobby cron 内 `writeContract()` 后 `waitForTransactionReceipt()`。这会重新引入 10 秒超时风险；如果等待或 DB 更新失败，还会重复发送同 URI 的 `setTokenURI`，至少造成 gas 浪费和 nonce 复杂度。

### [P2] 公开测试可观测性仍无法覆盖 material mint 的 failed / stuck 状态

位置：`app/api/health/route.ts:46-61`、`app/api/cron/queue-status/route.ts:50-57`、`reviews/phase-1-deferred.md:19-24`

`/api/health` 只暴露 `mint_queue` 的 pending / minting 数量，不暴露 failed、retry、oldest age、last_error；`queue-status` 又只看 `score_nft_queue`。也就是说 material mint 出现 failed 或 post-send stuck 后，公开版健康检查仍可能显示“队列不积压”。Phase 1 deferred 里已经写过“铸造失败监控 + 告警 / 数据补偿脚本”，到 Phase 5 公开测试前仍未闭环。

### [P2] 状态文档把“10/12 冒烟通过”写成 S0-S5 完成，和 playbook 完成标准冲突

位置：`STATUS.md:9-16`、`playbook/phase-5-testnet-public.md:407-423`、`playbook/phase-5-testnet-public.md:441-442`、`reviews/2026-04-24-phase-5-s5-smoke-test.md:9-24`

Phase 5 S5 的验证标准是 12 项冒烟测试全通，但当前 smoke 文档明确是 10/12，且 B9 乐谱铸造延后、Bug #3 仍阻塞 tester。`STATUS.md` 仍写“✅ S0-S5 完成”，会误导后续 AI 或协作者以为阶段已经无条件完成。更准确的状态应是“部署完成，Phase 5 完成标准未达；进入 tester 前仍有阻塞项”。

## 已知但未修复的问题

### [P1] Bug #3 operator 钱包余额过低，仍然阻塞 tester

位置：`reviews/2026-04-24-phase-5-s5-smoke-test.md:32-37`、`TASKS.md:14-22`

当前文档记录 OP Sepolia operator 余额低于 0.05 ETH，修复动作是 faucet 补到 0.1+ ETH。因为所有 tester 的收藏 / 铸造都由 operator 代付 gas，这不是“上线后观察”的问题，而是 tester 前置条件。没有补足余额就放 10-20 人测试，失败会集中表现为“收藏没反应 / cron 失败”。

### [P1] Bug #5 草稿铸造按钮未实现，Phase 5 S5 的 B9 核心业务仍未通过

位置：`reviews/2026-04-24-phase-5-s5-smoke-test.md:70-78`、`src/components/me/DraftCard.tsx:32-45`、`src/data/jam-source.ts:61-71`、`playbook/phase-5-testnet-public.md:419-423`

后端 `POST /api/mint/score` 和 score queue 已存在，但 `/me` 的草稿卡片没有铸造入口，前端数据层也没有调用 `/api/mint/score` 的函数。只要这一点没补，Phase 5 不能按 playbook 口径算“12 项冒烟全通”。如果 Phase 6 UI 重设计时才接上按钮，会立刻踩到本轮新增的 ScoreNFT cron P0，因此这不是单纯 UI 延后项。

### [P2] Bug #1 岛屿快速连点仍可触发音频叠加，首页乐器主体验有回归风险

位置：`reviews/2026-04-24-phase-5-s5-smoke-test.md:63-68`、`src/components/player/PlayerProvider.tsx:70-94`、`src/components/archipelago/Island.tsx:44-47`

`toggle()` 依赖 React state 判断当前是否播放，但 `play()` 的 fetch / decode 是异步的。快速连点时，第二次点击可能在 `playing` 变成 true 之前进入另一个 `play()`，两个调用都能越过 `sourceRef.current` 的 stop 逻辑。这个问题不阻塞 material mint 的窄范围 tester，但会影响“首页即乐器”的第一印象。

### [P2] AirdropNFT 仍没有 metadata / `setTokenURI`，发出去的奖励 NFT 还是空壳

位置：`app/api/cron/process-airdrop/route.ts:146-151`、`contracts/src/AirdropNFT.sol:35-41`、`TASKS.md:31-34`

空投 cron 当前只调用 `mint()`，成功后记录 `token_id`，没有上传 metadata，也没有调用合约已提供的 `setTokenURI()`。如果空投不纳入 tester 范围，必须在状态文档里明确“不对 tester 承诺空投展示”；如果纳入，当前实现不能算产品可用。

### [P3] Rate limit 虽已证明线上工作，但仍是 fail-open 且只有日志级观测

位置：`middleware.ts:36-45`、`middleware.ts:70-72`、`middleware.ts:101-108`、`playbook/phase-5-testnet-public.md:275-279`

这符合 playbook 里“Upstash 宕机时 fail open”的取舍，不是本轮阻塞项。但公开 tester 后，一旦 env 缺失或 Upstash 网络失败，成本敏感端点会直接放行；当前只有 Vercel runtime log，没有健康检查状态、告警或熔断。剩余风险是：下一次真失效时，运营侧仍可能靠事后日志排查。

## 已复核为修复的问题

- `src/components/auth/LoginButton.tsx:31-45`：地址按钮已改为跳 `/me`，登出改成独立文字按钮，Bug #2 不再复现为“点地址直接退出”。
- `app/api/cron/check-balance/route.ts:54-58` + `src/types/jam.ts:101-117`：score 队列积压统计已改用 `SCORE_ACTIVE_STATUSES`，上一轮 `uploading_sounds` 拼错状态名的问题已修。
- `reviews/2026-04-24-phase-5-s5-smoke-test.md:39-52`：Bug #6 已修订为测试方法误判；当前证据支持线上 rate limit 正常工作。

## 结论

1. 当前阶段是否可以算完成：**否**。可以算“Phase 5 部署上线完成”，但不能算“Phase 5 完成标准达成”。原因是 playbook 要求 12/12 冒烟全通，而当前仍是 10/12，并且本轮发现了 material mint 与 ScoreNFT cron 的 P0 级事务/并发问题。

2. 是否可以进入 tester / 下一阶段：**不建议进入公开 tester，也不建议进入 Phase 6**。如果一定要小范围放人，只能在修掉 MaterialNFT 并发重复入队、operator faucet 后，限定 tester 范围为“素材收藏链路”，并明确不测试乐谱铸造和空投。Phase 6 会接上草稿铸造 UI，必须先修 ScoreNFT cron P0，否则下一阶段会把隐藏问题直接暴露给用户。

3. 下一步最优先修的 3 件事：
   - **先修 material mint 原子唯一性 + 爱心失败回退**：DB 层加 `(user_id, token_id)` 级别的唯一/事务保护，前端只有 API 入队成功后才持久显示红心。
   - **再修 ScoreNFT cron 的事务/并发语义**：增加 durable lease 或状态锁，DB 写 `tx_hash` 失败进入人工核查状态，receipt pending 不算失败，并把 `setTokenURI` 拆出 `uri_tx_hash`。
   - **最后补 operator faucet + 重新跑 12 项 smoke**：至少把 Bug #3 解掉，再按 playbook 全量复测；B9 如果继续延后，需要把 STATUS/TASKS 明确改成“Phase 5 部署完成，B9 延后，不算完整收口”。
