# STATUS — 项目当前状态

> 这是给"人 + AI"共用的状态面板。AI 每次完成一个小闭环都要更新这里。
> 字段简短，不要超过 30 行。详细历史看 git log。

---

## 当前阶段

**Phase**: Phase 1 ✅ 完成 → Phase 2 规划完成，待执行
**目标**: Phase 2 — 合奏 + 草稿系统

## 当前进度

**做到哪**: Phase 1 全部完成 + review 修复 + Phase 2 playbook v2 已就绪
**下一步**: Phase 2 Step 0（Web Audio 合奏 spike 技术验证）
**playbook**: `playbook/phase-2/` 全套（overview + step-0 + track-a/b/c）

### 续做指南（下次会话第一件事读这段）

Phase 2 计划已通过 CTO review 并修正为 v2。下次会话直接开始 Step 0 spike：
- 读 `playbook/phase-2/step-0-spike.md`，通过 4 个标准后分线
- 读 `playbook/phase-2/overview.md` 了解文件 ownership 和冻结契约
- 共享类型：`src/types/jam.ts`（API 命名已冻结）
- 关键决策：Arweave 后移 Phase 3 / 草稿私有预览 / 录制上限 60s+500 事件
- 合约地址（Phase 1）：`0x99F808bdE8E92f167830E4b9C62f92b81c664b7C`
- API route 放在 `app/api/`；npm 用 `--legacy-peer-deps`；`@/*` 映射项目根
- Foundry 在 `C:\foundry`
- Phase 1 worktree `E:\Projects\nft-music-frontend` 可清理
- 延后项：`reviews/phase-0-deferred.md` + `reviews/phase-1-deferred.md`

测试钱包地址：`0x306D3A445b1fc7a789639fa9115e308a34231633`（OP Sepolia 已领 faucet）

## 上次成功验证

- 验证内容: Phase 1 全链路 — 登录 → 浏览 tracks → 播放 → 铸造 → cron 上链 → 个人页看到 NFT
- 验证时间: 2026-04-09
- 验证方式: 浏览器完整流程 + Supabase 确认 mint_events
- 通过的 commit: `bbb8ed9`（merge 回 main）

## 当前阻塞

- 无

## 备注（AI 写给下次会话的自己）

- 项目命名：仓库 `ripples-in-the-pond` / 代号 `ripples-in-the-pond` / 产品名 `Ripples in the Pond`（本地文件夹仍是 `nft-music`，历史遗留）
- **链：OP Mainnet（生产）/ OP Sepolia（测试）**——不用 ETH L1，详见 ARCHITECTURE.md 决策 3
- Next.js 16.1.6 + React 19；ARCHITECTURE.md 已同步
- Windows 环境，hooks 用 Git Bash 跑
- 学习模式: slow mode（默认）
- 学习机制：SessionStart 注入 STATUS/TASKS，Stop 检查未提交改动，复述 1-3 行关键代码（AGENTS §4 第 4 步）
- 文件硬线 220 行 / 目录 8 文件；route.ts 放宽 270；`src/app/api/**` 整棵子树豁免目录限制
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
