# Phase 6 — 稳定性收口 + UI 重设计

> **目标**：把 Phase 1-5 两轮严格 CTO review 发现的 29 项 findings 全部收口 +
> 基于 tester 反馈做 UI 重设计，让产品达到 Phase 7 OP 主网的完成标准。
>
> **前置**：Phase 5 收口完成（commit `b0474f1`）+ Phase 1-4 回看 review 已出
> （`reviews/2026-04-25-phase-1-4-strict-cto-review.md`）
>
> **原则**：多 track 并行；每 track 有独立验证标准；只有 Track B 的 UI 重设计
> 依赖 tester 反馈，其余 track 可以和 tester 反馈轮并行推进。
>
> **核心交付物**：
> - 5 tracks 全部 steps ✅ → 代码层满足主网部署要求
> - Tester 反馈反哺 UI 重设计（Track B2 输入）
> - 决策落地：主网是否做空投 / Semi 登录是否在 Phase 6 接入

---

## 冻结决策（开工前必须对齐）

### D1 — 多 track 并行，非线性推进

29 项 findings 按域切到 5 track。Track 之间只有**少量**依赖关系（Track B3 依赖 A1），其余 track 可独立开工。不要把 Phase 6 当成"一个长 playbook 按顺序打"。

### D2 — Pre-tester gate（进入并行开工前的 3 件事）

3 项 tester 会高频踩到的必修先做完再放人：

| # | 所属 | 内容 | 预估 |
|---|---|---|---|
| A2 | Track A | material failed 重试语义 | 30-60 分钟 |
| B1 | Track B | NFT localStorage 按 user_id 隔离 | 30 分钟 |
| E1 | Track E | /api/health 暴露 mint_queue 的 failed / stuck / retry / oldest_age | 30-60 分钟 |

这 3 项完成 → 限定范围 tester 放人 1-2 周收反馈 → Track B2 UI 重设计启动。

### D3 — Track A 是 Track B3 的硬前置

接通草稿铸造按钮（B3）前必须先完成 ScoreNFT cron 四连（A1）。否则 tester 踩到双 mint / 孤儿 NFT / 可覆盖 metadata 这几个 P0 事故。

### D4 — Track D 条件性：主网是否做空投

Track D（空投闭环）需要产品决策。两种路径：

- **做** → D1-D6 全套修复
- **不做**（主网纯铸造，不含奖励 NFT）→ 只做 D2（admin header 鉴权）+ 在 STATUS 明确标"空投代码挂起、不对主网承诺"，其余 steps 挂起到未来某个 Phase

### D5 — Track E2 Semi 登录条件性

E2（Semi 前端接入）依赖 Semi 团队 OAuth 就绪。若 Phase 6 期间仍未就绪，E2 挂起到 Phase 7 前。不阻塞 Phase 6 完结。

### D6 — 所有 migrations 走 `supabase/migrations/phase-6/`

本 Phase 新增 DB 变更统一进 phase-6 子目录，从 `021_xxx.sql` 开始编号（Phase 4 最后一条是 020）。

### D7 — Phase 6 不触碰主网

Phase 6 完结 = 所有合约有"可主网部署"版本 + 所有后端 cron 恢复语义闭环 + UI 重设计上线。**主网真部署放 Phase 7**。

---

## 5 Tracks 总览

| Track | 主题 | Step 数 | 对应 findings | 依赖 |
|---|---|---|---|---|
| **[A](./track-a-mint-stability.md)** | 铸造链路稳定性 | 6 | #1 #3 #17 #18 #19 #21 #22 | 无 |
| **[B](./track-b-ui-redesign.md)** | UI 重设计 + 前端体验 | 5 | #2 #7 #8 #9 #23 #29 | B2 等 tester 反馈；B3 依赖 A1 |
| **[C](./track-c-contracts.md)** | 合约 & 部署硬化 | 4 | #6 #13 #14 #16 #20 | 无 |
| **[D](./track-d-airdrop.md)** | 空投闭环（条件） | 6 | #4 #5 #10 #11 #12 #25 | D1 产品决策 |
| **[E](./track-e-auth-observability.md)** | 认证 & 观测收口 | 5 | #15 #24 #26 #27 #28 | E2 依赖 Semi OAuth |

29 findings 全部覆盖。编号见 `reviews/2026-04-25-phase-1-4-strict-cto-review.md` +
`reviews/2026-04-25-phase-5-strict-cto-review.md`。

---

## 推荐时间线

```
Day 0: Phase 6 kickoff
  ├─ Pre-tester gate (1-2 hours)
  │    └─ A2 + B1 + E1 → 部署 → 限定范围 tester 放人
  │
  ├─ Week 1-2: Tester 反馈窗口（用户主导，1-2 周）
  │    └─ 并行开工 Track A 剩余 / Track C / Track D / Track E
  │
  ├─ Week 2-3: Tester 反馈归档 + Track B2 UI 重设计启动
  │    └─ Track A 完结 → 启动 B3（接草稿铸造按钮）
  │
  ├─ Week 3-5: UI 重设计 + 剩余 track 收口
  │
  └─ Week 5-6: Phase 6 完结 review + 进入 Phase 7 主网准备
```

**总工作量粗估**：3-6 周（取决于 Track D 是否全做 + Semi OAuth 是否就绪 + UI 重设计深度）。

---

## Phase 6 完结标准（进 Phase 7 的 gate）

- [ ] Track A 6 step 全绿
- [ ] Track B 5 step 全绿（B2 UI 重设计完成度由产品侧判断）
- [ ] Track C 4 step 全绿
- [ ] Track D 按 D1 决策完成相应范围
- [ ] Track E 5 step 全绿或明确挂起理由（E2）
- [ ] `bash scripts/verify.sh` 全绿
- [ ] 29 findings 全部状态闭环（修复 / 明确挂起 / 降级）
- [ ] `reviews/2026-04-XX-phase-6-completion-review.md`（由第三方 review agent 出）
- [ ] `STATUS.md / TASKS.md / docs/JOURNAL.md` 同步

---

## 参考文档

- [Phase 5 收口 review](../../reviews/2026-04-24-phase-5-completion-review.md)
- [Phase 5 严格 CTO review](../../reviews/2026-04-25-phase-5-strict-cto-review.md)
- [Phase 1-4 严格 CTO review](../../reviews/2026-04-25-phase-1-4-strict-cto-review.md)（29 findings 来源）
- [S5 冒烟测试](../../reviews/2026-04-24-phase-5-s5-smoke-test.md)
- [决策日志 2026-04-25 段](../../docs/JOURNAL.md)
