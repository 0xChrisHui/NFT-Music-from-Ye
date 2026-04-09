# Phase 0 Review — 认同但延后的改进项

> 来源：`2026-04-09-phase-0.md` + `2026-04-09-phase-0-cto.md`
> 这些问题我们认同存在，但判断现阶段性价比不高，延后处理。
> 每条标注了"建议在哪之前修"，到时候回来检查。

---

## 上主网前必须修（Phase 4 之前）

- **每用户限频 + 队列积压上限 + 全局熔断** — sponsored mint 是烧钱接口，上主网前必须有反滥用护栏
- **热钱包权限模型梳理** — deployer 和 operator 应该分离，MINTER_ROLE 只给 operator，deployer 私钥离线保存
- **`server-only` 包 + 环境变量启动校验** — 把注释约定升级为机制强制
- **余额告警** — 运营钱包余额低于阈值时通知，防止 cron 静默失败
- **结构化日志 + 错误分级** — 用户可见错误 vs 内部日志分层

## Phase 2 之前建议修

- **队列表结构补强** — 加 `locked_at` / `processing_started_at` / `completed_at` / `last_error` 字段，`status` 改为枚举约束
- **健康检查端点** — `/api/health` 检查数据库连接 + 钱包余额 + 队列积压
- **队列可观测性** — 简单的 pending/success/failed 计数，方便排查

## Phase 1 期间顺手做

- **清理 Foundry 模板文件** — `Counter.sol` / `Counter.t.sol` / `Counter.s.sol`
- **补齐 `LEARNING.md` / `ERRORS.md`** — slow mode 学习闭环落地
- **合约 URI 占位符** — Phase 1 换成真实 Arweave 元数据地址时一并解决
