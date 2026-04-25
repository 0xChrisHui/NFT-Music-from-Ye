# Phase 1-4 严格 CTO Review

> 范围：按当前代码回看 Phase 1-4 交付物，判断它们是否真的达到阶段完成标准，是否能支撑 Phase 5 tester、Phase 6 UI 重设计与后续 OP 主网。
> 口径：findings 优先；本文件不解释代码，只做 gate review。

## 本轮新增发现

### [P1] failed material mint 会被前端当成成功，且阻断用户重试

位置：`app/api/mint/material/route.ts:58-68`、`src/hooks/useFavorite.ts:45-52`、`app/api/cron/process-mint-queue/steps.ts:182-190`

维度：代码正确性、幂等性、用户体验、可运营性。

`POST /api/mint/material` 对同一 `idempotency_key` 命中已有 job 时，`pending / minting / failed` 都返回 `{ result: "ok" }`。如果第一次因为余额、RPC、链上 revert 进入 `failed`，用户再次点收藏会继续拿到 failed job 的 id，前端仍显示成功，但后端不会重新入队。公开 tester 中这会表现为“红心亮了，但永远不上链”，且用户没有自救路径。

### [P1] NFT localStorage 缓存没有按用户隔离，会跨账号泄漏红心和个人页状态

位置：`src/lib/nft-cache.ts:8-9`、`src/lib/nft-cache.ts:13-19`、`src/lib/nft-cache.ts:32-38`、`app/me/page.tsx:32-40`、`src/components/archipelago/Archipelago.tsx:22-24`

维度：用户体验、产品语义、恢复语义。

`ripples_minted_token_ids` 和 `ripples_cached_nfts` 是浏览器全局 key，没有包含 `user_id` 或 `evm_address`。共享浏览器、多账号切换、登出重登时，新用户会先看到上一个用户的红心和 `/me` NFT 缓存，再等待后台刷新纠正。对 NFT 产品来说，这会被用户理解成资产错乱。

### [P1] 链上事件同步单条写入失败后仍推进 cursor，会永久漏掉 Transfer

位置：`app/api/cron/sync-chain-events/route.ts:67-85`、`app/api/cron/sync-chain-events/route.ts:92-96`

维度：事务性、恢复语义、下一阶段返工风险。

`sync-chain-events` 在循环里对单条 `chain_events.upsert` 失败只记录日志，不中止本轮同步；最后仍更新 `last_synced_block`。一次 Supabase 短抖就可能让某个 Transfer 永久不再重扫，后续 `/me` owner 投影、空投 holder 快照都会建立在错误链上事实上。

### [P1] 空投快照没有检查链上同步新鲜度，可能按过期 holder 发奖

位置：`app/api/airdrop/trigger/route.ts:52-53`、`app/api/airdrop/trigger/route.ts:108-120`、`app/api/cron/sync-chain-events/route.ts:36-42`

维度：产品语义、可运营性、下一阶段返工风险。

空投触发直接从 `chain_events` 计算每个 token 的当前 owner，但没有确认 `last_synced_block` 是否接近 latest block，也没有要求先完成链上同步。只要同步任务落后，空投资格就不是“当前持有者”，会出现漏发或错发，后续只能人工补偿。

### [P1] 空投 cron 在已有 tx 未确认时仍会继续发送下一笔运营钱包交易

位置：`app/api/cron/process-airdrop/route.ts:47-49`、`app/api/cron/process-airdrop/route.ts:93-116`、`app/api/cron/process-airdrop/route.ts:120-155`

维度：并发安全、运营钱包 nonce 风险、恢复语义。

`getTransactionReceipt` 查不到时返回 pending 语义，但主流程随后仍调用 `trySendNew()`。这会在同一轮 cron 内让一个未确认交易和下一笔新交易并行存在，违反“运营钱包交易必须串行”的项目约束，也会放大 nonce replacement、RPC pending 池和链上恢复风险。

### [P1] ScoreNFT metadata 可被 MINTER_ROLE 任意覆盖，和“永久作品”语义冲突

位置：`contracts/src/ScoreNFT.sol:43-48`、`contracts/test/ScoreNFT.t.sol:91-95`

维度：产品语义、架构一致性、上线风险。

`setTokenURI` 没有限制“只能首次设置”或“同 URI 幂等写”，测试还明确允许 `ar://first` 覆盖成 `ar://second`。这意味着运营钱包或任何保留 `MINTER_ROLE` 的地址都能改已经铸造作品的 metadata。测试网可容忍，主网前必须收紧，否则“永久可复现”的核心承诺不成立。

### [P2] tracks 没有 ISR/cache/error fallback，数据库短抖会让首页群岛静默消失

位置：`docs/ARCHITECTURE.md:154-156`、`docs/ARCHITECTURE.md:284`、`app/api/tracks/route.ts:11-22`、`src/data/tracks-source.ts:7-11`、`src/components/archipelago/Archipelago.tsx:26-48`

维度：架构一致性、用户体验、可运营性。

ARCH 明确要求 `GET /api/tracks` 使用 ISR/缓存，DB 故障时浏览仍可用。当前实现直接查 Supabase，前端失败返回空数组，`Archipelago` 在 `tracks.length === 0` 时直接 `null`。线上 Supabase 抖动会让核心“群岛”区域消失，没有错误态也没有旧数据兜底。

### [P2] 移动端 fallback 首帧仍可能加载桌面音效引擎

位置：`docs/ARCHITECTURE.md:334-335`、`src/components/jam/HomeJam.tsx:18-44`、`src/hooks/useJam.ts:37-59`

维度：架构一致性、用户体验、边界条件。

Phase 2 决策是移动端仅浏览不可演奏，但 `HomeJam` 初始 `isMobile=false`，首帧会先渲染 `HomeJamDesktop`，再由 effect 改成移动提示。手机上仍可能触发 `useJam` 加载 26 个音效资源，影响首屏和流量，也和“移动端不加载音效引擎”的注释不一致。

### [P2] 草稿 localStorage 损坏没有恢复语义，会拖垮 `/me` 与收藏上传链路

位置：`src/lib/draft-store.ts:15-22`、`app/me/page.tsx:56-69`、`src/hooks/useFavorite.ts:55-69`

维度：边界条件、恢复语义、用户体验。

`getDrafts()` 直接 `JSON.parse(raw)`，没有 try/catch、schema 校验或损坏数据清理。旧版本测试数据、手工污染、浏览器插件写坏 localStorage 时，`/me` 初始渲染和 favorite 时自动上传草稿都会抛错，导致页面或收藏流程失败。

### [P2] 空投触发不是事务性流程，中途失败会留下不可重试的 draft round

位置：`app/api/airdrop/trigger/route.ts:36-47`、`app/api/airdrop/trigger/route.ts:72-83`

维度：事务性、恢复语义、可运营性。

空投触发按“插入 round -> 插入 recipients -> 标记 ready”三步执行，不在同一个数据库事务/RPC 里。若 recipients 插入或 ready 更新失败，会留下 `draft` round；再次触发会因 `round` 唯一约束返回 409，只能人工修库。

### [P2] 管理员空投触发仍使用 query token，泄露面偏大

位置：`app/api/airdrop/trigger/route.ts:9`、`app/api/airdrop/trigger/route.ts:18-20`

维度：上线风险、安全运营。

`ADMIN_TOKEN` 通过 `?token=` 传递，容易进入浏览器历史、Vercel/代理访问日志、截图和复制链接。这个接口能创建空投轮次并间接消耗运营钱包，公开测试或主网前应改成 `Authorization: Bearer` 或等价 header 鉴权。

### [P2] 空投失败不会阻止 round 标记 done，health 也看不到 failed/backlog

位置：`app/api/cron/process-airdrop/route.ts:83-88`、`app/api/cron/process-airdrop/route.ts:187-198`、`app/api/health/route.ts:18-26`

维度：可运营性、恢复语义、用户体验。

`recoverStuck()` 会把未知状态标成 `failed`，而 `markRoundDoneIfComplete()` 只检查是否还有 `pending/minting`，不会因 `failed` recipient 阻止 round `done`。健康检查也没有空投 failed/backlog 指标。运营侧可能看到“空投完成”，但实际有人没收到。

### [P2] 主网部署脚本会真实 mint 一张无 metadata 的测试 ScoreNFT

位置：`contracts/script/DeployOrchestrator.s.sol:36-43`

维度：上线风险、产品语义。

`DeployOrchestrator` 在授权后直接 `orchestrator.mintScore(deployer)` 做端到端验证，但没有 metadata 上传和 `setTokenURI`。测试网已有 tokenId 1 可接受；主网照跑会污染正式合集第一张 NFT，且该 token 永久没有可展示 metadata。

### [P2] TBA 开关是空实现，“无需重部署”注释不成立

位置：`contracts/src/MintOrchestrator.sol:61-72`

维度：架构一致性、下一阶段返工风险。

`setTbaEnabled(true)` 只会让 `_maybeCreateTba()` 进入空分支。已部署 Solidity 代码不能在未来“补实现钩子”，除非新部署合约或升级架构。Phase 6/7 若仍规划 ERC-6551，需要把它当成未实现能力，而不是已经预埋的开关。

### [P2] Score Decoder 入口绑定单一网关，fallback 只有 HTML 成功加载后才生效

位置：`app/api/cron/process-score-queue/steps-upload.ts:108-114`、`src/data/score-source.ts:88-96`、`src/score-decoder/index.html:59-63`

维度：恢复语义、用户体验、架构一致性。

`animation_url` 和公开页 iframe 都先指向 `https://arweave.net/{decoder}`。Decoder HTML 内部虽有多网关 fallback，但如果入口网关不可达，HTML 根本加载不到，内部 fallback 没机会运行。对“永久回放页”来说，这仍是单点入口。

### [P2] ScoreNFT 仍保留 operator 对合约的直接 MINTER_ROLE，可绕过 Orchestrator

位置：`contracts/src/ScoreNFT.sol:29-30`、`contracts/script/DeployOrchestrator.s.sol:36-40`、`contracts/src/MintOrchestrator.sol:46-55`

维度：架构一致性、权限最小化、上线风险。

Phase 3 设计上把 cron 入口收束到 `MintOrchestrator.mintScore()`，但部署后 operator 仍可直接调用 `ScoreNFT.mint()` 和 `ScoreNFT.setTokenURI()`。测试网可当应急口，主网前需要明确是否 revoke 直接 minter 权限，否则事故面和审计面都扩大。

## 已知但未修的问题

### [P0] ScoreNFT cron 的幂等、并发与 post-send 恢复语义仍不达 Phase 6 标准

位置：`app/api/cron/process-score-queue/steps-chain.ts:58-88`、`app/api/cron/process-score-queue/route.ts:98-109`、`supabase/migrations/phase-3/hotfix/015_claim_score_queue_rpc.sql:9-22`

来源：`reviews/2026-04-25-phase-5-strict-cto-review.md:14-30` 已指出。

维度：幂等性、事务性、并发安全、恢复语义。

`mintScore` 仍是先广播交易、再写 `tx_hash`。DB 写失败后，下一轮会再次发送；`claim_score_queue_job()` 只有 SQL 瞬时锁，没有 durable lease；receipt pending 会被外层失败逻辑计入 retry，最终可能把已广播交易标成 failed。这是 Phase 6 一接草稿铸造按钮就会暴露的 P0。

### [P2] `setTokenURI` 仍未拆成 `uri_tx_hash` 两阶段恢复

位置：`app/api/cron/process-score-queue/steps-chain.ts:115-131`、`supabase/migrations/phase-3/009_score_nft_queue.sql:24-26`

来源：`reviews/2026-04-25-phase-5-strict-cto-review.md:44-48`、`TASKS.md:38` 已记录。

维度：恢复语义、上线风险、可运营性。

当前 `setTokenURI` 没有独立 tx hash 字段，仍是发交易、等确认、写 DB 的单次阻塞步骤。Vercel 超时或 DB 写失败时会重复发链上交易，至少造成 gas 浪费和 nonce 复杂度。

### [P1] 草稿保存仍不是事务/RPC 原子操作

位置：`app/api/score/save/route.ts:101-143`、`supabase/migrations/phase-0-2/006_pending_scores_unique.sql:15-18`

来源：`reviews/2026-04-10-phase-2.5-completion-review.md:89-117` 已指出。

维度：事务性、恢复语义、用户体验。

保存草稿时先把旧 draft 标成 `expired`，再插入新 draft。若插入失败，旧草稿已经失效，用户会丢掉原本仍有效的创作。Phase 6 草稿铸造前，这会从“边界 bug”变成真实资产化前的数据丢失风险。

### [P1] admin / minter 权限分离仍停留在意图，没有形成可执行部署流程

位置：`contracts/script/Deploy.s.sol:15-25`、`contracts/script/DeployScore.s.sol:10-19`、`contracts/script/DeployAirdropNFT.s.sol:10-25`、`contracts/src/MaterialNFT.sol:20-23`、`contracts/src/ScoreNFT.sol:29-30`

来源：`reviews/2026-04-10-phase-2.5-completion-review.md:23-50`、`reviews/phase-0-deferred.md:12` 已指出。

维度：架构一致性、上线风险、权限最小化。

部署脚本仍默认用 `OPERATOR_PRIVATE_KEY` 完成部署，并让同一地址拿到 admin/minter 或实际控制 minter。主网前如果没有 `ADMIN_ADDRESS` / `MINTER_ADDRESS` 参数化脚本或部署后 revoke/renounce runbook，热钱包被盗会同时影响铸造和合约管理权限。

### [P1] `/score/[tokenId]` 没有真正链上灾备路径，永久回放仍依赖 DB 完整性

位置：`docs/ARCHITECTURE.md:345`、`src/data/score-source.ts:6-10`、`src/data/score-source.ts:29-36`

来源：`reviews/2026-04-12-phase-3-completion-review.md:183-209` 已指出。

维度：架构一致性、恢复语义、产品语义。

ARCH 写明公开回放页数据来源是 `mint_events.score_data`，灾备链路是链上 `tokenURI -> Arweave`。当前实现查不到 `mint_events` 就直接返回 `null`。DB 丢行或停服时，已上链 ScoreNFT 仍会 404，和“永久可复现”不一致。

### [P1] “我的乐谱”仍按最初 mint 用户展示，不按链上当前 owner 展示

位置：`app/api/me/score-nfts/route.ts:20`、`app/api/cron/sync-chain-events/route.ts:66-85`

来源：`reviews/2026-04-12-phase-3-completion-review.md:156-170` 已指出。

维度：产品语义、链上事实一致性、下一阶段返工风险。

`chain_events` 已经同步 Transfer，但 `/api/me/score-nfts` 仍按 `score_nft_queue.user_id` 查。ScoreNFT 转手后，原用户还会看到它，接收者看不到。Phase 6 做个人页 UI 重设计前必须先决定 owner 投影口径。

### [P1] 草稿铸造前端入口仍未接上，Phase 3 能力不是完整产品闭环

位置：`app/me/page.tsx:153-161`、`src/components/me/DraftCard.tsx:17-45`、`TASKS.md:28-38`

来源：`reviews/2026-04-25-phase-5-strict-cto-review.md:70-74`、`reviews/2026-04-24-phase-5-s5-smoke-test.md:70-73` 已指出。

维度：用户体验、产品语义、下一阶段返工风险。

后端 `POST /api/mint/score` 和 score queue 已存在，但 `/me` 草稿卡片只有标题和倒计时，没有铸造按钮或前端数据函数。Phase 6 如果直接把 UI 接上，会立刻撞到 ScoreNFT cron P0。

### [P1] Semi 登录前端仍未接入，Phase 4 社区登录不能算完成

位置：`src/hooks/useAuth.ts:9-21`、`src/components/auth/LoginButton.tsx:15-23`、`app/me/page.tsx:93-103`、`STATUS.md:76-93`

来源：`reviews/2026-04-13-phase-4-completion-review.md:17-27` 已指出，`STATUS.md` 也标注 S3 挂起。

维度：阶段完成标准、用户体验、架构一致性。

当前前端仍是 Privy-only，没有社区 JWT localStorage fallback、没有 Semi 登录按钮、没有 JWT logout/revoke 入口。若 Phase 4 被定义为“社区钱包 + 空投”，它不能算完整完成；如果当前 Phase 5 tester 继续走 Privy-only，需要在所有对外口径里明确 Semi 不在测试范围。

### [P1] AirdropNFT 仍是空壳资产，没有 metadata / tokenURI 链路

位置：`app/api/airdrop/trigger/route.ts:25-30`、`app/api/cron/process-airdrop/route.ts:146-151`、`contracts/src/AirdropNFT.sol:35-41`

来源：`reviews/2026-04-13-phase-4-completion-review.md:112-138`、`reviews/2026-04-25-phase-5-strict-cto-review.md:82-86` 已指出。

维度：产品语义、用户体验、上线风险。

空投 cron 当前只 `mint()`，没有上传 metadata，也没有调用 `setTokenURI()`。如果空投不纳入 tester，必须明确“不承诺空投资产展示”；如果纳入测试或主网，当前不是可展示奖励资产。

### [P2] `/api/health` 仍没有 Semi 可达性探针

位置：`playbook/phase-4-community.md:286`、`app/api/health/route.ts:18-75`、`src/lib/auth/semi-client.ts:15-18`

来源：`reviews/2026-04-13-phase-4-completion-review.md:140-152` 已指出。

维度：可运营性、观测、上线风险。

playbook 要求健康检查覆盖 Semi API 可达性，但当前 `/api/health` 只看 DB、钱包、队列、JWT 黑名单和余额。Semi 配置缺失或服务不可达时，监控不会反映登录链路风险。

### [P2] material mint failed/stuck 仍缺运营视图

位置：`app/api/health/route.ts:46-61`、`app/api/cron/queue-status/route.ts:50-57`、`reviews/phase-1-deferred.md:19-24`

来源：`reviews/phase-1-deferred.md:20`、`reviews/2026-04-25-phase-5-strict-cto-review.md:50-54` 已指出。

维度：可运营性、告警、公开测试风险。

公开 tester 主测素材收藏，但 `/api/health` 不暴露 `mint_queue.failed`、`retry_count`、oldest age 或 `last_error`，`queue-status` 又只看 score queue。失败任务可能只能靠日志事后排查。

### [P2] playbook 与 STATUS 对 Semi 路线的口径仍分裂

位置：`playbook/phase-4-community.md:22-36`、`STATUS.md:93`、`docs/JOURNAL.md:87-90`

来源：Phase 4 后的挂起决定已写入 STATUS/JOURNAL，但 playbook 未同步。

维度：架构一致性、下一阶段返工风险。

playbook 仍把 Semi 描述为 `/send_sms + /signin` Bearer API 的前端登录流程，STATUS/JOURNAL 则说等待 Semi OAuth/开放登录确认。下一位协作者如果只看 playbook，可能继续接一条已冻结的内部 API 路线。

### [P2] 岛屿快速连点音频叠加仍是首页主体验风险

位置：`src/components/player/PlayerProvider.tsx:70-120`、`src/components/archipelago/Island.tsx:44-47`

来源：`reviews/2026-04-24-phase-5-s5-smoke-test.md:24-30`、`reviews/2026-04-25-phase-5-strict-cto-review.md:76-80` 已指出。

维度：用户体验、边界条件、下一阶段返工风险。

`toggle()` 依赖 React state 判断当前播放状态，但 `play()` 的 fetch/decode 是异步的。快速连点可能在 state 更新前进入多个 `play()`，造成音频叠加。它不阻塞窄范围素材收藏 tester，但会影响首页第一印象。

## 3 个明确结论

1. 当前阶段是否可以算完成：**不能无保留算完成**。Phase 1-2 的核心浏览/收藏/合奏链路可以算可用雏形；Phase 3 的 ScoreNFT 链路仍有 P0 幂等/恢复问题；Phase 4 的 Semi 登录和空投资产语义仍是挂起或半闭环状态。因此 Phase 1-4 只能算“主线能力已搭建”，不能算“公开测试级完成标准已达成”。

2. 是否可以进入 tester / 下一阶段：**不建议进入公开 tester，也不建议直接进入 Phase 6**。如果必须小范围测试，只能在修掉 material failed job 重试语义、NFT 缓存用户隔离、operator 余额后，限定为“素材收藏 + 个人页 + artist 页”，并明确不测草稿铸造、Semi 登录、空投。Phase 6 接草稿铸造 UI 前，必须先修 ScoreNFT cron P0。

3. 下一步最优先修的 3 件事：
   - **第一优先：ScoreNFT cron 恢复语义重做**。加 durable lease / 全局 operator 串行，`tx_hash` 未落库进入人工核查，receipt pending 不算失败，并拆出 `uri_tx_hash`。
   - **第二优先：素材收藏 tester 前状态闭环**。failed job 必须可重试或明确返回失败，localStorage NFT 缓存按用户隔离，health 暴露 material failed/stuck。
   - **第三优先：链上事实与资产永久性收口**。修 `chain_events` cursor 推进规则、空投快照新鲜度、ScoreNFT tokenURI 不可任意覆盖，并补 `/score/[tokenId]` 链上灾备。
