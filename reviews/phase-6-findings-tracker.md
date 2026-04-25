# Phase 6 Findings Tracker

> Phase 1-5 三轮严格 CTO review 合集的 findings + Phase 6 playbook review 新增 P0/P1。
> Phase 6 期间每 step 完成后在本文件更新状态。Phase 6 完结 review 会按这张表逐项核对。

**状态说明**：
- `open` — 未开始
- `in_progress` — 正在做
- `fixed` — 代码已修 + 验证通过
- `deferred-justified` — 明确挂起，原因记录
- `downgraded-accepted` — 降级接受，原因记录

---

## 来自 Phase 1-4 严格 CTO Review（`reviews/2026-04-25-phase-1-4-strict-cto-review.md`）

### 本轮新增

| ID | 严重 | 标题 | 归属 step | 状态 | 验证证据 |
|---|---|---|---|---|---|
| P14-1 | P1 | failed material mint 被当成功 | Track A2 | open | — |
| P14-2 | P1 | NFT localStorage 跨账号泄漏 | Track B1 | open | — |
| P14-3 | P1 | sync-chain-events 单条失败推进 cursor | Track A3 | open | — |
| P14-4 | P1 | 空投快照无链上同步新鲜度检查 | Track D3 | open | — |
| P14-5 | P1 | 空投 cron 未确认 tx 时仍发下笔 → 运营钱包锁 | Track **A0** | open | — |
| P14-6 | P1 | ScoreNFT metadata 可被 MINTER_ROLE 任意覆盖 | Track C1 | open | — |
| P14-7 | P2 | tracks 无 ISR/cache/error fallback | Track B5 | open | — |
| P14-8 | P2 | 移动端 fallback 首帧加载桌面音效引擎 | Track B5 | open | — |
| P14-9 | P2 | 草稿 localStorage 损坏无恢复 | Track B5 | open | — |
| P14-10 | P2 | 空投触发 3 步非事务 | Track D3 | open | — |
| P14-11 | P2 | admin 空投用 query token | Track D2 | open | — |
| P14-12 | P2 | 空投 failed 不阻止 round done / health 无指标 | Track D4 | open | — |
| P14-13 | P2 | 主网部署脚本 mint 无 metadata 测试 ScoreNFT | Track C3 | open | — |
| P14-14 | P2 | TBA 开关是空实现 | Track C4 | open | — |
| P14-15 | P2 | Score Decoder 入口绑单一网关 | Track E4 | open | — |
| P14-16 | P2 | ScoreNFT 保留 operator 直接 MINTER_ROLE | Track C2 | open | — |

### 已知未修（来源 Phase 5 严格 review）

| ID | 严重 | 标题 | 归属 step | 状态 | 验证证据 |
|---|---|---|---|---|---|
| P14-17 | P0 | ScoreNFT cron 幂等/并发/post-send 恢复语义 | Track A1 | open | — |
| P14-18 | P2 | setTokenURI 未拆 uri_tx_hash | Track A1 | open | — |
| P14-19 | P1 | 草稿保存非事务原子 | Track A4 | open | — |
| P14-20 | P1 | admin/minter 权限分离停留在意图 | Track C2 | open | — |
| P14-21 | P1 | /score/[tokenId] 无链上灾备路径 | Track A5 | open | — |
| P14-22 | P1 | 我的乐谱按初始 mint 用户而非 owner（产品决策）| Track A6 | open | — |
| P14-23 | P1 | 草稿铸造前端入口未接上（bug #5）| Track B3 | open | — |
| P14-24 | P1 | Semi 登录前端未接入 | Track E2 | open（条件）| — |
| P14-25 | P1 | AirdropNFT 空壳资产 | Track D5 | open（条件）| — |
| P14-26 | P2 | /api/health 无 Semi 可达性探针 | Track E3 | open | — |
| P14-27 | P2 | material failed/stuck 无运营视图 | Track E1 | open（Pre-tester）| — |
| P14-28 | P2 | playbook 与 STATUS Semi 口径分裂 | Track E5 | open | — |
| P14-29 | P2 | 岛屿快速连点音频叠加 | Track B4 | open | — |

---

## 来自 Phase 6 Playbook CTO Review（`reviews/2026-04-25-phase-6-playbook-cto-review.md`）

本轮在 playbook 上层的发现，已触发 playbook 重写：

| ID | 严重 | 标题 | 处理方式 | 状态 |
|---|---|---|---|---|
| P6P-1 | P0 | A2 reset 所有 failed 会触发重复 mint | **playbook 重写**：A2 加 failure_kind 区分 safe_retry / manual_review | fixed（playbook 层）|
| P6P-2 | P0 | 运营钱包全局锁被放进条件空投 Track | **playbook 重写**：从 D4 升级为 Track A0 必修 | fixed（playbook 层）|
| P6P-3 | P0 | A1 Durable Lease 规格不完整 | **playbook 重写**：A1 补 lease_owner + heartbeat + CAS on all updates | fixed（playbook 层）|
| P6P-4 | P1 | Track C 合约重部署可能污染 tester 窗口 | **playbook 重写**：Track C 必须 Pre-tester 前完成（D-C0 冻结）| fixed（playbook 层）|
| P6P-5 | P1 | Pre-tester gate 缺运营就绪检查 | **playbook 重写**：加 G0（balance / cron / env / health / smoke）| fixed（playbook 层）|
| P6P-6 | P1 | 多 track 并行缺 ownership | **playbook 重写**：Overview 加共享资源 ownership 表 | fixed（playbook 层）|
| P6P-7 | P1 | A6 改 owner 投影冲突 JOURNAL 决策 | **playbook 重写**：A6 变产品决策 gate | fixed（playbook 层）|
| P6P-8 | P1 | D5（原 D6）OpenSea testnet 验证不可执行 | **playbook 重写**：改 Etherscan + Arweave direct fetch 验证 | fixed（playbook 层）|
| P6P-9 | P1 | 条件性挂起项缺主网承诺边界 | **playbook 重写**：Phase 6 完结必须产出 STATUS "主网承诺边界" 段 | fixed（playbook 层）|
| P6P-10 | P2 | B2 UI 重设计验收过于主观 | **playbook 重写**：B2 拆 B2.0-B2.5，每页截图验收 | fixed（playbook 层）|
| P6P-11 | P2 | 29 findings 无 traceability matrix | **本文件即为 tracker** | fixed（playbook 层）|

---

## 产品决策 Gate（Kickoff 必须冻结）

| Gate | 选项 | 决策日期 | 决策内容 | 影响的 step |
|---|---|---|---|---|
| **A6** `/me` 语义 | 我铸造的 / 我持有的 / 双分区 | 待定 | 待定 | Track A6 + B2.2 |
| **D1** 主网是否做空投 | 做 / 不做 | 待定 | 待定 | Track D 全体 |
| **E2** Semi 登录是否 Phase 6 接入 | 接 / 挂 Phase 7 | 待定 | 待定 | Track E2 |

决策在 `docs/JOURNAL.md` 2026-04-XX 条目冻结。

---

## 统计

- **总 findings**：29（Phase 1-4 + Phase 5 合集）
- **Phase 6 playbook review 新增**：11（P0×3 + P1×6 + P2×2）
- **需要产品决策 gate**：3（A6 / D1 / E2）
- **总 action items**：43+

## Phase 6 完结验收

Phase 6 完结 review（`reviews/2026-04-XX-phase-6-completion-review.md`）必须检查：
- [ ] 本表每一行状态为 `fixed` / `deferred-justified` / `downgraded-accepted`
- [ ] `deferred-justified` 和 `downgraded-accepted` 在 JOURNAL 有原因记录
- [ ] A6 / D1 / E2 三个 gate 都有冻结决策
- [ ] STATUS.md "主网承诺边界" 与挂起项一致
