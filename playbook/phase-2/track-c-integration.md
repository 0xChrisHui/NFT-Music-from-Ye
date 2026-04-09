# Phase 2 Track C — 集成：合奏接入真实数据 + 草稿管理 + e2e

> 🎯 **目标**：把 Track A 的 API 和 Track B 的合奏 UI 接在一起，加草稿管理，完成 Phase 2 全流程
>
> **前置**：Track A + Track B 都完成并 merge
> **分支**：在 `feat/phase2-backend` 上继续

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| C0 | merge Track B + 解决冲突 | verify 全绿 + npm run dev 正常 |
| C1 | 适配层切换：mock → 真实 API | 合奏页从数据库读 sounds |
| C2 | 首页加"合奏"入口 | 岛屿点击后能进入合奏页 |
| C3 | 草稿管理：/me 加草稿列表 + 倒计时 | 个人页看到草稿 |
| C4 | 端到端验证 + merge 回 main | 完整流程跑通 |

---

# Step C0：merge Track B

## 🎯 目标
合并前端分支。

## 📦 范围
- `git merge feat/phase2-frontend`
- 预期冲突极少：B 只新建文件（`app/jam/`、`src/components/jam/`、`src/hooks/useJam.ts` 等），不碰 A 的文件

## ✅ 完成标准
- merge 无报错
- `bash scripts/verify.sh` 全绿
- `npm run dev` 正常

---

# Step C1：适配层切换 mock → 真实 API

## 🎯 目标
把 Track B 的假数据替换为 Track A 的真实 API。

## 📦 范围
- `src/data/jam-source.ts`（改内部实现）
- 可删除 `src/data/mock-sounds.ts`

## ✅ 完成标准
- 合奏页的音效列表从 /api/sounds 读取
- 保存草稿调真实 POST /api/score/save
- 预览从真实 GET /api/scores/[id]/preview 读取

---

# Step C2：首页加"合奏"入口

## 🎯 目标
岛屿组件加一个"合奏"按钮/链接，点击跳转到 `/jam/[trackId]`。

## 📦 范围
- `src/components/archipelago/Island.tsx`（加合奏入口）
- 可能 `app/page.tsx`（微调布局）

## ✅ 完成标准
- 每个岛屿下方有"合奏"链接（和"铸造"按钮并列）
- 点击 → 跳转到 /jam/xxx
- 未登录也能进（合奏不需要登录，保存才需要）

---

# Step C3：草稿管理

## 🎯 目标
个人页加草稿列表，显示倒计时。

## 📦 范围
- `app/api/me/scores/route.ts`（新建，Track A 没做的话在 C 里做）
- `app/me/page.tsx`（修改，加草稿区域）
- `src/components/me/DraftCard.tsx`（新建）

## ✅ 完成标准
- 个人页显示"我的草稿"区域
- 每个草稿显示曲目名 + 剩余时间倒计时
- 点击草稿 → 跳转到 /jam/[trackId] 预览
- 过期草稿不显示

---

# Step C4：端到端验证 + merge 回 main

## 🎯 目标
跑通完整用户流程。

## 📦 范围
- 更新 STATUS.md / TASKS.md
- `git checkout main && git merge feat/phase2-backend`

## ✅ 完成标准
完整流程：
1. 首页浏览岛屿
2. 点击岛屿 → 播放
3. 点击"合奏" → 进入合奏页
4. 键盘演奏 + 视觉反馈
5. 录制 → 停止 → 回放
6. 保存草稿 → 跳转个人页
7. 个人页看到草稿 + 倒计时
8. （铸造和之前一样，不是 Phase 2 新增）

- Etherscan 无需新 tx（Phase 2 不涉及新的链上操作）
- STATUS.md 标记 Phase 2 完成
