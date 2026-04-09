# Phase 1 Track A — 后端 + 合约 + 集成

> 🎯 **目标**：从"能跑的 demo"升级到"有数据、有产品合约、前端能调的 MVP 后端"
>
> **前置**：Phase 0 全部完成 + review 修复完成
>
> **分支**：`feat/phase1-backend`（开发完成后 merge 回 main）

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| A0 | 建 tracks + mint_events 表 + 清理模板 | Dashboard 看到表 |
| A1 | 自定义 MaterialNFT 合约 + 部署 | Etherscan 看到新合约 |
| A2 | tracks 数据填充 + GET /api/tracks/[id] | curl 返回 track JSON |
| A3 | 等 TB 完成 → merge 前端分支 | merge 无冲突，npm run dev 正常 |
| A4 | 铸造按钮接入前端 | 浏览器点击 → mint_queue 出现记录 |
| A5 | 个人页接入真实数据 | 登录后看到自己铸造的 NFT 列表 |
| A6 | 端到端验证 | 完整流程跑通 |

---

# Step A0：建 tracks + mint_events 表 + 清理模板

## 🎯 目标
按 ARCHITECTURE 决策 4，Phase 1 需要 4 张表。Phase 0 已有 users + mint_queue，现在补 tracks + mint_events。顺手清理 Foundry 模板文件。

## 📦 范围
- `supabase/migrations/003_tracks_and_mint_events.sql`（新建）
- Supabase Dashboard 执行 SQL
- 删除 `contracts/src/Counter.sol` / `contracts/test/Counter.t.sol` / `contracts/script/Counter.s.sol`

## 🚫 禁止
- 不改现有的 users / mint_queue 表结构
- 不建 Phase 2+ 的表（sounds / pending_scores 等）

## ✅ 完成标准
- Dashboard Table Editor 看到 tracks 和 mint_events 两张表
- tracks 表字段与 `src/types/tracks.ts` 的 Track 接口对齐
- mint_events 表字段与 MintEvent 接口对齐
- Foundry 模板文件已删除
- `forge build` 仍然通过

## 🔍 验证命令
```bash
bash scripts/verify.sh
```

## ⏪ 回滚点
Dashboard DROP TABLE。SQL 文件 git checkout 还原。

---

# Step A1：自定义 MaterialNFT 合约 + 部署

## 🎯 目标
用自己的 Solidity 代码替换 OZ Preset，加入产品级逻辑（URI 管理、allowlist mint 权限）。部署到 OP Sepolia。

## 📦 范围
- `contracts/src/MaterialNFT.sol`（新建）
- `contracts/script/Deploy.s.sol`（修改）
- `.env.local`（更新合约地址）
- `src/lib/contracts.ts`（更新 ABI）

## 🚫 禁止
- 不写 ScoreNFT（Phase 3）
- 不部署主网
- 不用 `onlyOwner` 做 mint 权限（用 allowlist / AccessControl）
- 不删旧合约地址（Phase 0 的留作记录）

## ✅ 完成标准
- `forge build` 通过
- `forge script Deploy.s.sol --broadcast` 输出新合约地址
- 新合约在 OP Sepolia Etherscan 可查
- operator 地址有 MINTER_ROLE
- `.env.local` 更新为新地址
- cron 用新合约能 mint 成功

## 🔍 验证命令
```bash
cd contracts && forge build
# 部署后浏览器查 Etherscan
# curl 测试 mint API + cron 全链路
```

## ⏪ 回滚点
部署失败不影响旧合约，改回旧地址即可。

---

# Step A2：tracks 数据填充 + GET /api/tracks/[id]

## 🎯 目标
填入 3-5 条测试 track 数据，写一个 API 返回单曲详情（含当前用户是否已铸造）。

## 📦 范围
- `supabase/seeds/tracks.sql`（新建，种子数据）
- `app/api/tracks/[id]/route.ts`（新建）
- Supabase Dashboard 插入种子数据

## 🚫 禁止
- 不做分页 / 搜索 / 筛选（Phase 2）
- 不上传真实音频到 Arweave（Phase 2）

## ✅ 完成标准
- Dashboard 里 tracks 表有 3-5 条记录
- `curl http://localhost:3000/api/tracks/<id>` 返回 `TrackDetailResponse` 格式的 JSON
- 带 Authorization header 时，`minted` / `pending` 字段反映真实状态
- 不带 header 时，`minted: false, pending: false`

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
# curl 测试
```

## ⏪ 回滚点
```bash
git checkout HEAD -- app/api/ supabase/
```

---

# Step A3：等 TB 完成 → merge 前端分支

## 🎯 目标
把 Track B（前端体验）的代码合并进来。

## 📦 范围
- Git merge 操作
- 解决可能的冲突（预期极少）

## ✅ 完成标准
- merge 无报错
- `npm run dev` 正常启动
- `bash scripts/verify.sh` 全绿
- 浏览器能看到 TB 的新首页 + 播放条

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
```

---

# Step A4：铸造按钮接入前端

## 🎯 目标
首页的 Island 组件加一个铸造按钮，点击调 POST /api/mint/material，显示状态反馈。

## 📦 范围
- `app/page.tsx`（修改）或相关页面组件
- 可能新建 `src/components/MintButton.tsx`
- 可能新建 `src/hooks/useMint.ts`

## 🚫 禁止
- 不在前端直接调合约
- 不做复杂动画（Phase 2）

## ✅ 完成标准
- 登录后在 track 详情/岛屿旁看到"铸造"按钮
- 点击 → 按钮显示"铸造中…" → 成功后显示"已铸造"
- mint_queue 出现 pending 记录
- 未登录时按钮显示"登录后铸造"或隐藏

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
# 浏览器操作
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/
```

---

# Step A5：个人页接入真实数据

## 🎯 目标
TB 已经写好个人页骨架，现在接入 GET /api/me/nfts 真实数据。

## 📦 范围
- `app/api/me/nfts/route.ts`（新建）
- 修改 TB 的个人页组件，把假数据替换为 fetch
- 可能新建 `src/hooks/useMyNFTs.ts`

## 🚫 禁止
- 不做 NFT 转让 / 交易功能
- 不做分页（Phase 2）

## ✅ 完成标准
- 登录后访问个人页，看到已铸造的 NFT 列表
- 每条显示 track 名称 + tx_hash 链接
- pending 状态的显示"铸造中"
- 没有 NFT 时显示空状态提示

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
# 浏览器登录后查看个人页
```

---

# Step A6：端到端验证

## 🎯 目标
跑通完整用户流程：登录 → 浏览 tracks → 播放 → 铸造 → cron 上链 → 个人页看到 NFT。

## 📦 范围
- 不写代码
- 跑完整流程
- 更新 STATUS.md / TASKS.md

## ✅ 完成标准
- 全流程无报错
- Etherscan 看到新的 mint tx
- 个人页显示刚铸造的 NFT
- STATUS.md 标记 Phase 1 完成
