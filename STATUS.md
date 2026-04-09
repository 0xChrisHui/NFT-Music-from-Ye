# STATUS — 项目当前状态

> 这是给"人 + AI"共用的状态面板。AI 每次完成一个小闭环都要更新这里。
> 字段简短，不要超过 30 行。详细历史看 git log。

---

## 当前阶段

**Phase**: Phase 0 — Minimal Closed Loop
**目标**: 1 天内跑通 "前端 → API → 队列 → 链上 1 笔 mint"

## 当前进度

**做到哪**: Phase 0 Step 4 ✅ 完成 — Supabase 建 users + mint_queue 两张表，用户 Dashboard 确认
**下一步**: Phase 0 Step 5 — MaterialNFT 部署 OP Sepolia（用 OZ 现成合约）
**playbook**: `playbook/phase-0-minimal.md` Step 5

### 续做指南（下次会话第一件事读这段）

Step 4 已收尾（commit `e0105f5`）。下次会话直接读 `playbook/phase-0-minimal.md` 的 Step 5：
- 目标：用 OZ ERC1155PresetMinterPauser 部署到 OP Sepolia，Etherscan 能查到合约
- 需要 Foundry（forge），用户可能还没装
- npm 装了 `--legacy-peer-deps`（ox 版本冲突），后续 install 也需要加这个 flag
- tsconfig `@/*` 映射到项目根 `"./*"`，src 下的文件 import 要写 `@/src/...`

测试钱包地址：`0x306D3A445b1fc7a789639fa9115e308a34231633`（OP Sepolia 已领 faucet）

## 上次成功验证

- 验证内容: Phase 0 Step 4 完成 — Supabase users + mint_queue 建表
- 验证时间: 2026-04-09
- 验证方式: Supabase Dashboard Table Editor 确认两张表存在
- 通过的 commit: `e0105f5`

## 当前阻塞

- 无（等用户注册账号是预期等待，不是阻塞）

## 备注（AI 写给下次会话的自己）

- 项目命名：仓库 `ripples-in-the-pond` / 代号 `ripples-in-the-pond` / 产品名 `Ripples in the Pond`（本地文件夹仍是 `nft-music`，历史遗留）
- **链：OP Mainnet（生产）/ OP Sepolia（测试）**——不用 ETH L1，详见 ARCHITECTURE.md 决策 3
- Next.js 16.1.6 + React 19；ARCHITECTURE.md 已同步
- Windows 环境，hooks 用 Git Bash 跑
- 学习模式: slow mode（默认）
- 学习机制：SessionStart 注入 STATUS/TASKS，Stop 检查未提交改动，复述 1-3 行关键代码（AGENTS §4 第 4 步）
- 文件硬线 220 行 / 目录 8 文件；route.ts 放宽 270；`src/app/api/**` 整棵子树豁免目录限制
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
