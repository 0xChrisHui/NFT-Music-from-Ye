# Phase 5 Completion Review

日期：2026-04-24  
范围：Phase 5 公开测试版当前仓库代码（以 `HEAD` 和工作区现状为准）

## Findings

### [P0] `process-mint-queue` 仍有“链上已发、数据库未记住”时的重复铸造风险，而且会把成功链路过早标成 `success`

位置：`app/api/cron/process-mint-queue/route.ts:117-140`, `app/api/cron/process-mint-queue/route.ts:147-166`

现在的控制流是：

1. `writeContract()` 先发链上交易
2. 然后才回写 `mint_queue.tx_hash`
3. `try` 块里任意一步抛错，都会走 `resetToPending()`

这意味着如果交易已经成功广播，但数据库写 `tx_hash` 失败，任务会被重置回 `pending`，下次 cron 会再次发送 mint，直接造成重复铸造。

同一个 handler 里还有第二个恢复边界问题：`markSuccess()` 先把 `mint_queue.status` 改成 `success`，再写 `mint_events`。如果 `mint_events` 插入失败，队列已经离开 `minting_onchain`，后续 cron 不会再补写这条永久记录，前端 `/me` 这类依赖 `mint_events` 的页面会长期丢资产展示。

对公开测试网来说，这是 tester 前必须收掉的阻塞级问题，因为它会制造“链上有了，站内没有”或“重复铸造”的脏状态。

### [P0] `process-airdrop` 复制了同样的 post-send 回滚错误，空投链路也可能重复发 NFT

位置：`app/api/cron/process-airdrop/route.ts:132-151`

这里的模式和 `process-mint-queue` 完全一样：先 `simulateContract/writeContract`，再写 `airdrop_recipients.tx_hash`。一旦交易已经发出去，但数据库更新失败，`catch` 会直接 `resetToPending(recipient.id)`，下一次 cron 就会给同一个接收者再 mint 一次。

这类 bug 比普通失败更危险，因为它不是“发不出去”，而是“发出去以后系统忘了自己发过”。一旦 tester 开始真实跑空投，这种脏状态后续很难人工收口。

### [P1] AirdropNFT 仍然只做了裸 mint，没有补写 `tokenURI`，当前发出去的奖励 NFT 还是空壳

位置：`app/api/cron/process-airdrop/route.ts:89-99`, `app/api/cron/process-airdrop/route.ts:132-147`  
对照：`contracts/src/AirdropNFT.sol:35-39`

合约本身已经提供了 `setTokenURI()`，类型层也有 `AirdropRound.audio_url / ar_tx_id`，但当前空投 cron 只做两件事：

- `mint()`
- 把 `token_id` 回写到 `airdrop_recipients`

没有任何 metadata 上传，也没有 `setTokenURI` 调用。结果就是：链上 token 发出去了，但在钱包、OpenSea 或后续分享链路里依然是空壳 NFT。

这条不是新问题，但它现在仍然存在于 Phase 5 当前代码里，所以我不会把空投链路判定为真正完成。

### [P1] 当前 rate limit 仍然是 fail-open，而且是静默失效；这和 `STATUS.md` 里的“bug #6 线上限流失效”是同一根问题

位置：`middleware.ts:36-53`, `middleware.ts:62-65`, `middleware.ts:93-95`

`middleware` 现在的策略是：

- Upstash 初始化失败：直接放行
- 运行时访问 Redis 失败：直接放行
- 放行时不给任何降级标记，也不会把系统切到显式告警状态

这在内部环境可以接受，但对“测试网公开版”不够。当前公开暴露的高成本端点包括 `/api/mint/*`、`/api/auth/*`、`/api/score/save`、`/api/airdrop/*`。一旦限流因为环境变量、Upstash 网络、SDK 初始化失败而掉线，系统会完全裸奔，而业务方只能从“线上怎么没拦住”倒推。

考虑到 `STATUS.md` 已经把这条列成 tester 前必修 bug，这里我会把它定性为仍未收口，不建议把 Phase 5 叫做“完成且可放量测试”。

### [P1] `check-balance` 的 score 队列积压统计写错了状态名，运维告警会漏报真正的卡住任务

位置：`app/api/cron/check-balance/route.ts:53-62`  
对照：`src/types/jam.ts:101-107`

`check-balance` 统计 `score_nft_queue` 时使用了：

- `pending`
- `uploading_sounds`
- `uploading_metadata`
- `minting_onchain`

但当前冻结的 `ScoreMintStatus` 里根本没有 `uploading_sounds`，真正的状态名是 `uploading_events`。这会导致卡在上传 `events.json` 的任务完全不计入 `scoreBacklog`，告警低估积压程度。

Phase 5 的核心价值之一是“线上真实运行 + 观测性”。如果最关键的乐谱队列监控从一开始就漏数，后面很多“系统看起来没问题”的判断都会被误导。

### [P1] 登录按钮的主交互仍然是“点地址就退出”，已知用户 bug 还原样留在主路径上

位置：`src/components/auth/LoginButton.tsx:38-44`

当前已登录态下，右上角地址短串按钮直接绑定 `logout`。这和 `STATUS.md` 里 bug #2 完全一致：用户点击钱包地址时会直接登出。

这不是微小体验瑕疵，而是公开测试阶段会高频触发的主路径 bug。用户通常会把这个按钮理解成“账户入口”或“个人页入口”，而不是“退出登录”。如果不先改掉，tester 很容易把它反馈成“登录系统不稳定”。

## Open Questions

- `STATUS.md` 现在写的是“Phase 5 S0-S5 完成（10/12 冒烟测试通过）”，但同一个文件又明确列出了 3 个 tester 前必修 bug。建议把“完成”的语义改成“部署完成，但未达到可放量测试门槛”，避免误导下一位 AI 或协作者。
- 空投链路到底是否纳入当前 tester 范围，需要你们明确一下。如果要纳入，空壳 NFT 不能继续留着；如果暂时不纳入，建议在 `STATUS.md / TASKS.md` 明写“空投仅内部验证，不对 tester 承诺”。

## Verification

- `bash scripts/verify.sh` ✅ 通过
- `npm run build` ✅ 通过
- 构建期额外信息：Next.js 提示 `middleware` 约定已 deprecated，未来建议迁移到 `proxy`，但这次不构成阻塞

## 建议的处理顺序

1. 先修 `process-mint-queue` 和 `process-airdrop` 的 post-send 幂等边界，确保“链上已发但 DB 未记住”时不会重复 mint。
2. 再决定 AirdropNFT 是不是纳入本轮 tester 范围；纳入就补 metadata + `setTokenURI`，不纳入就把状态说清楚。
3. 然后修 rate limit 的失效观测和 `check-balance` 的错误状态名，恢复公开版最基本的防滥用和告警可信度。
4. 最后收口 `LoginButton` 这个 tester 必踩的主交互 bug，再进入下一轮公开测试。
