# Phase 6 Playbook CTO Review

## Findings

### [P0] A2 把所有 `failed` 素材任务重置为 `pending`，会重新打开重复 mint 风险

位置：`playbook/phase-6/track-a-mint-stability.md` A2、`app/api/cron/process-mint-queue/steps.ts` 的 stuck 处理、`app/api/mint/material/route.ts` 的 existing job 复用逻辑。

Phase 6 把 A2 放进 pre-tester gate，并推荐对 `existing.status === 'failed'` 直接重置为 `pending`。这个规则不安全。当前 material cron 已经把一种高危状态标成 `failed`：`minting_onchain + tx_hash = null` 超时，含义是“链上交易可能已经广播，但 DB 没存住 hash，需要人工查 operator 钱包历史”。这类 job 如果被 A2 重新入队，可能对同一用户同一素材再次发 mint，和 Phase 5 刚修掉的重复铸造问题相冲突。

这不是实现细节小洞，而是 pre-tester gate 自己可能制造 P0 事故。A2 不能只改 `app/api/mint/material/route.ts`，必须先给 `mint_queue` 增加可判定的失败类型，例如 `failure_kind = 'safe_retry' | 'manual_review'` 或等价字段；cron 写 failed 时必须写清楚原因；API 只能重试明确安全的失败，`manual_review` 必须返回 409/503 和可理解提示。

### [P0] 运营钱包全局串行锁被放进条件性空投 Track，默认路径会跳过主网必修项

位置：`playbook/phase-6/overview.md` 的 pre-tester gate、`playbook/phase-6/track-d-airdrop.md` D-D2/D4。

全局 operator 钱包串行不是“空投启用时才需要”的问题。material mint、ScoreNFT mint、airdrop 都使用同一个 EOA，只要任意两个 cron 在同一分钟发交易，就有 nonce race 风险。当前 playbook 把 D4 设成 `D1 = 做空投` 才做；而 Track D 的默认假设又是用户没明确说做就视为不做。这会让“主网前必须全系统串行”的风险在默认路径里被跳过。

这个 finding 会把技术债带进 Phase 7，因为 Phase 6 完结标准声称“所有后端 cron 恢复语义闭环”。建议把 D4 从 Track D 移出，升级为 Track A0 或 Pre-mainnet gate；如果限定 tester 前只开放 material，可以不一定挡 tester，但必须挡 B3 草稿铸造、任何空投 cron、以及 Phase 6 completion。

### [P0] A1 的 Durable Lease 规格不完整，仍可能出现 stale worker 覆盖状态

位置：`playbook/phase-6/track-a-mint-stability.md` D-A1 与 Step A1。

文档冻结决策写的是 `claim + lease(expires_at) + heartbeat`，但落地步骤只新增 `locked_at / lease_expires_at`，没有 `lease_owner` 或 `lease_token`，也没有 heartbeat、释放锁、或“所有状态推进必须带 owner CAS”的要求。这样只能减少并发窗口，不能证明并发安全：A worker 拿到 lease 后卡住，lease 过期；B worker 接手并推进；A worker 恢复后仍可能用 `.eq('id', row.id)` 写回旧状态或 tx hash。

A1 是 Phase 6 最核心的 P0 修复，不能用半个 lease 模式。需要把规格补成：claim 时生成唯一 `lease_owner`；每次 DB update 都必须 `where id = ? and lease_owner = ? and lease_expires_at > now()`；长步骤 heartbeat；成功/失败后释放 lease；lease 过期后的 worker 不允许再写状态。否则 B3 接草稿铸造按钮仍然会踩双处理和状态覆盖。

### [P1] Track C 被标为可并行，但合约重部署会污染 tester 反馈窗口

位置：`playbook/phase-6/overview.md` D1/时间线、`playbook/phase-6/track-c-contracts.md` C1/C4 与“重部署合约的影响”。

Playbook 说 Track C 无依赖、可与 tester 反馈并行推进；但 C1/C4 会重部署 ScoreNFT/Orchestrator，并更新 `.env.local` 与 Vercel env。这样会在 tester 1-2 周窗口内改变合约地址、tokenId 空间和 `/me`、`/score` 的展示来源。文末虽然提醒旧 NFT 可能不显示，但没有明确“测试窗口中是否允许切合约地址”的发布策略。

这会让 tester 反馈失真：用户今天看到的乐谱、明天可能因为环境切换消失。建议把 Track C 拆出发布窗口：要么 pre-tester 前完成并部署新版合约；要么等 tester 反馈结束后集中切换；如果必须中途切，必须有多合约兼容查询或明确的测试网资产废弃公告。

### [P1] Pre-tester gate 缺少运营前置检查，无法证明 tester 环境真的可用

位置：`playbook/phase-6/overview.md` D2、`STATUS.md` Phase 5 交付物、`reviews/2026-04-25-phase-5-strict-cto-review.md` operator faucet finding。

当前 pre-tester gate 只有 A2/B1/E1 三个代码项。它没有把 OP Sepolia operator gas 余额、5 个 cron 是否仍在跑、Vercel env 是否已同步、最近一次部署 hash、`/api/health` 实际返回、以及小范围 smoke 纳入 gate。尤其是历史 review 明确指出 operator faucet/余额会直接阻塞 tester，而 STATUS 里只记录了 Turbo credits，没有记录 OP Sepolia operator 余额已达测试阈值。

这会让“代码修完即可放人”的判断过早。建议 pre-tester gate 增加一个 `G0 运营就绪检查`：确认 operator OP Sepolia 余额阈值、cron-job.org 5/5 green、Vercel 环境变量同步、线上 `/api/ping` 和鉴权 `/api/health` 通过、素材收藏一条真实链路跑通。

### [P1] 多 track 并行缺少 ownership / merge mutex，实际执行会互相踩文件

位置：`playbook/phase-6/overview.md` D1、各 track 的范围字段。

阶段拆成 5 个 track 是合理的，但 ownership 还不够执行级。多个 track 会同时碰共享文件：`app/api/health/route.ts`、`src/types/tracks.ts`、`docs/ARCHITECTURE.md`、`STATUS.md`、`.env.local`、Vercel env、migrations 编号、以及未来的 `operator-lock.ts`。如果多 AI 或多分支并行推进，当前文档没有规定谁拥有这些共享面、谁合并、谁负责部署窗口。

这不是文档洁癖；它会导致 migration 冲突、health 字段互相覆盖、环境变量更新漏同步。建议 overview 增加“共享资源 ownership 表”：health/HealthResponse 归 Track E 统一合并；operator-lock 归 Track A；合约地址和 Vercel env 只能由 release owner 改；migrations 由一个人按编号分配。

### [P1] A6 更改 `/me` 语义，和既有 JOURNAL 决策冲突

位置：`playbook/phase-6/track-a-mint-stability.md` A6、`docs/JOURNAL.md` 2026-04-12 条目。

A6 要把 `/api/me/score-nfts` 从“初始 mint 用户”改成“链上当前 owner”。但 JOURNAL 里已有明确产品决策：`/me` 展示“我铸造的”而非“我持有的”，当时认为转手场景不值得增加复杂度。现在 playbook 直接改成 owner 投影，相当于推翻产品语义，却没有 D-step 或用户确认。

这会影响 UI、文案和用户理解：一个用户铸造的作品转走后是否还属于“我的乐谱”？接收者是否看到创作来源？建议把 A6 改成产品决策 gate：保留“我铸造的”、改成“我持有的”、或做两个分区。决定后同步 JOURNAL/ARCH/页面文案。

### [P1] D6 的验证标准依赖 OpenSea testnet 可见性，和项目既有决策冲突

位置：`playbook/phase-6/track-d-airdrop.md` D6、`STATUS.md` 长期决策补丁。

D6 要求“测试网 mint 一张空投 NFT → OpenSea 可见名字 + 图”。但 STATUS 已经记录 OpenSea 永久停止 testnet，项目硬门槛已改成 Etherscan + 直接 fetch Arweave 替代方案。这个验证标准不可稳定执行，会让 Track D 的 done 状态依赖一个已被项目废弃的外部入口。

建议把 D6 验证改成：链上 `tokenURI` 可读、Arweave metadata/image 可直接 fetch、Etherscan 交易和事件可核验、前端或脚本能渲染 metadata。OpenSea 主网展示只能放到 Phase 7 主网上线后验证，不应作为 OP Sepolia Phase 6 gate。

### [P1] 条件性挂起项没有“退出 Phase 6 的产品承诺边界”

位置：`playbook/phase-6/overview.md` D4/D5/完结标准、`playbook/phase-6/track-d-airdrop.md` D1、`playbook/phase-6/track-e-auth-observability.md` E2。

Track D 可以默认“不做”，E2 可以挂起到 Phase 7；但 overview 又说 Phase 6 完结后代码层满足主网部署要求，29 findings 全部闭环。这里缺少一个产品边界声明：如果空投不做、Semi 不接，那么 Phase 7 的主网版本到底承诺什么、不承诺什么？哪些入口要关闭？哪些 cron 要停？哪些 README/ARCH 文案要改？

建议把 D1/E2 的结果变成 Phase 6 kickoff 的冻结决策，而不是执行中自然挂起。若不做空投，必须停用 `process-airdrop` cron、关闭/隐藏入口、ARCH/STATUS/TASKS 统一写“不进入主网承诺”。若 Semi 未就绪，必须明确主网首版 Privy-only，不把登录债务带进 Phase 7。

### [P2] B2 UI 重设计还不是可执行任务，验收标准过于主观

位置：`playbook/phase-6/track-b-ui-redesign.md` B2。

B2 方向是对的：等 tester 反馈后再做 UI 重设计。但目前验收靠“用户审核通过”和“三种浏览器视觉一致”，缺少页面级完成定义、移动端断点、截图验收、反馈优先级、以及哪些反馈明确不做的决策格式。这会让 1-2 周 UI 工作变成反复试稿。

建议把 B2 拆成：B2.0 反馈归档和优先级；B2.1 首页；B2.2 `/me`；B2.3 `/score`；B2.4 `/artist`；B2.5 跨浏览器截图验收。每个页面有单独范围、验收截图、用户确认点。

### [P2] “29 findings 全部覆盖”缺少 traceability matrix，completion review 容易漏项

位置：`playbook/phase-6/overview.md` tracks 总览与完结标准。

overview 写了 29 findings 全部覆盖，但只有按 track 聚合的编号，没有一张从 review finding → step → 状态 → 验证证据的矩阵。两个 review 文件里的编号不是全局唯一语义，且有重复/合并项；到 Phase 6 completion review 时，很难确认每一项是真的修复、挂起、还是降级接受。

建议新增 `reviews/phase-6-findings-tracker.md` 或在 overview 加矩阵：来源 review、finding 标题、严重级别、归属 step、处理方式、验证证据、最终状态。Phase 6 完结前逐项打勾。

## 建议

1. 先改 playbook，不建议马上按当前版本开工写代码。最小修订是：重写 A2 的 failed retry 语义、把 operator 全局锁移出条件性空投 Track、补完整 A1 durable lease 规格。

2. 把 pre-tester gate 从 3 项扩成 4 项：`G0 运营就绪检查` + A2 + B1 + E1。G0 不一定写很多代码，但必须产出可验证结果：余额、cron、部署、health、一次真实素材收藏 smoke。

3. 给 Phase 6 overview 增加 ownership 表。重点锁住共享文件和共享资源：health/types、migrations、合约地址、Vercel env、ARCH/STATUS/JOURNAL、operator wallet lock。

4. 把 Track C 的合约重部署从“可随时并行”改成“发布窗口”。建议 pre-tester 前不切合约；tester 期间也不切；等反馈窗口结束后一次性切，或明确多合约兼容策略。

5. 把 D1/E2/A6 这三个产品语义问题提前问清楚：主网是否承诺空投、主网首版是否 Privy-only、`/me` 是“我铸造的”还是“我持有的”。这些不是工程偏好，必须由用户决策。

6. 修掉不可执行的验证标准：OpenSea testnet 不再作为 Phase 6 gate；所有“模拟 DB 失败/并发 cron/网关屏蔽”的验证最好配脚本或最小手册，不要只写一句“手动模拟”。

## 最终结论

**这份 playbook 能不能开工：不能按当前版本直接开工。**

它的方向、阶段拆分和风险收敛目标是对的，5-track 的组织方式也基本合理；但当前有 3 个会影响安全边界的缺口：A2 可能重试人工核查类 failed job、operator 全局锁被条件性跳过、A1 durable lease 规格不完整。先改 playbook，再进入代码执行。

**开工前必须先改的事项：**

- P0-1：A2 failed retry 必须区分 `safe_retry` 和 `manual_review`，不能一律 reset。
- P0-2：operator 全局串行锁从 Track D 条件步骤升级为 Phase 6 必修 gate。
- P0-3：A1 durable lease 增加 `lease_owner`、heartbeat/release、以及所有状态推进的 owner CAS。
- P1：pre-tester gate 加 G0 运营就绪检查。
- P1：D1/E2/A6 的产品决策在 kickoff 冻结并写入 JOURNAL。

**可以边做边修的事项：**

- Track B2 的页面级验收拆分。
- findings traceability matrix。
- Track C 发布窗口和旧合约兼容策略。
- D6 OpenSea testnet 验证口径改为 Etherscan + Arweave direct fetch。
- 共享文件 ownership 表。
