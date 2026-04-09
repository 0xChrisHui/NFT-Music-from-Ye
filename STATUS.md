# STATUS — 项目当前状态

> 这是给"人 + AI"共用的状态面板。AI 每次完成一个小闭环都要更新这里。
> 字段简短，不要超过 30 行。详细历史看 git log。

---

## 当前阶段

**Phase**: Phase 0 — Minimal Closed Loop
**目标**: 1 天内跑通 "前端 → API → 队列 → 链上 1 笔 mint"

## 当前进度

**做到哪**: Phase 0 Step 0 ✅ 完成 — 3 个外部账号已注册、`.env.local` 10 key 填齐、doctor.sh 26 ✅ / 2 ⚠（Foundry 预期）/ 0 ❌、checkpoint `checkpoint/2026-04-09-1226` 已建
**下一步**: Phase 0 Step 1 — Next.js 项目调整成深色首页（项目已初始化，只改首页背景 + 加产品名字）
**playbook**: `playbook/phase-0-minimal.md` Step 1

### 续做指南（下次会话第一件事读这段）

Step 0 已全部收尾，Phase 0 Step 1 还没开始。下次会话直接读 `playbook/phase-0-minimal.md` 的 Step 1：
- 目标：浏览器访问 http://localhost:3000 看到全屏深色页 + 中央白色小字 "Ripples in the Pond"
- 项目已经 next init 过了，只需要改首页（`src/app/page.tsx`）+ 全局样式（`src/app/globals.css`）
- 不要装新包，不要碰 layout 之外的东西
- 完成后跑 `npm run dev` 肉眼验证 + 跑 `bash scripts/checkpoint.sh "Phase 0 Step 1 完成"`

测试钱包地址：`0x306D3A445b1fc7a789639fa9115e308a34231633`（OP Sepolia 已领 faucet）

## 上次成功验证

- 验证内容: Phase 0 Step 0 完成 — 项目改名为 Ripples in the Pond + 3 外部账号注册 + .env.local 填齐 + doctor.sh 全绿 + 首个 checkpoint
- 验证时间: 2026-04-09
- 验证方式: `bash scripts/doctor.sh`（26 ✅ / 2 ⚠ / 0 ❌）+ `bash scripts/checkpoint.sh`
- 通过的 commit: `cd456ff`（checkpoint: Phase 0 起点演练）/ tag `checkpoint/2026-04-09-1226`

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
