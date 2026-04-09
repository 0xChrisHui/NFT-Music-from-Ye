# Phase 2 Track A — 后端：sounds + Arweave + 草稿 API

> 🎯 **目标**：建好合奏所需的数据层 + Arweave 基础设施 + 草稿保存/预览 API
>
> **分支**：`feat/phase2-backend`
> **与 Track B 并行**，完成后进入 Track C

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| A0 | sounds + pending_scores 表 | Dashboard 看到表 |
| A1 | sounds 种子数据（26 个音效） | Dashboard 有 26 条记录 |
| A2 | @ardrive/turbo-sdk 设置 + 测试上传 | Arweave 上能查到测试文件 |
| A3 | POST /api/score/save（保存草稿） | curl 返回 scoreId |
| A4 | GET /api/scores/[id]/preview（预览草稿） | curl 返回草稿数据 |
| A5 | Phase 1 延后项：/me 展示 pending/failed 状态 | 个人页有完整状态 |

---

# Step A0：sounds + pending_scores 表

## 🎯 目标
按 ARCHITECTURE 决策 4，Phase 2 新增 2 张表。

## 📦 范围
- `supabase/migrations/005_sounds_and_pending_scores.sql`
- `src/types/jam.ts`（新建，合奏相关类型）

## 🚫 禁止
- 不改现有表
- 不建 Phase 3 的表

## ✅ 完成标准
- `sounds` 表：token_id (109-134), name, audio_url, duration_ms, category
- `pending_scores` 表：score_id, user_id, track_id, events_data (jsonb), created_at, expires_at (24h)
- 类型文件与表结构对齐

## ⏪ 回滚点
Dashboard DROP TABLE。

---

# Step A1：sounds 种子数据

## 🎯 目标
填入 26 个音效（A-Z 键各一个），每个有名称、分类、时长。Phase 2 用本地 mp3，Phase 3 换 Arweave URL。

## 📦 范围
- `supabase/seeds/sounds.sql`
- `public/sounds/` 下放 26 个短音效文件（可先用合成音代替）

## ✅ 完成标准
- Dashboard sounds 表有 26 条记录
- 每条有 token_id (109-134), name, category (percussion/melody/effect)
- GET /api/sounds 能返回列表（顺手写）

---

# Step A2：Arweave 基础设施

## 🎯 目标
安装 @ardrive/turbo-sdk，写 `src/lib/arweave.ts`（多网关 fallback），测试上传一个小文件。

## 📦 范围
- `npm i @ardrive/turbo-sdk --legacy-peer-deps`
- `src/lib/arweave.ts`（新建）
- 测试脚本或临时 API 验证上传

## 🚫 禁止
- 不批量上传所有资源（Phase 3 前做）
- 不在生产代码里硬编码网关地址

## ✅ 完成标准
- `src/lib/arweave.ts` 导出上传函数 + 多网关读取函数
- 成功上传一个测试文件到 Arweave
- 能用网关 URL 读取回来

## ⏪ 回滚点
```bash
git checkout HEAD -- src/lib/arweave.ts
```

---

# Step A3：POST /api/score/save

## 🎯 目标
保存合奏草稿到 pending_scores，24h 过期。

## 📦 范围
- `app/api/score/save/route.ts`（新建）

## 🚫 禁止
- 不在这里上传到 Arweave（那是 Phase 3 mint 时做的）
- 不铸造 NFT

## ✅ 完成标准
- POST body: `{ trackId, eventsData: [{key, time, duration}...] }`
- 返回 `{ result: 'ok', scoreId, expiresAt }`
- pending_scores 出现记录，expires_at = created_at + 24h
- 必须登录（Authorization header）
- 同一用户对同一 track 最多一个未过期草稿（新的覆盖旧的）

---

# Step A4：GET /api/scores/[id]/preview

## 🎯 目标
返回草稿数据，Track C 的预览播放器消费。

## 📦 范围
- `app/api/scores/[id]/preview/route.ts`（新建）

## ✅ 完成标准
- 返回 `{ score: { trackId, eventsData, expiresAt } }`
- 过期的草稿返回 404
- 必须是本人的草稿（或公开预览，产品决定）

---

# Step A5：/me 展示 pending/failed 状态

## 🎯 目标
Phase 1 延后项：个人页不只显示成功，也显示"铸造中"和"失败"。

## 📦 范围
- `app/api/me/nfts/route.ts`（修改，加 pending/failed 查询）
- `src/types/tracks.ts`（OwnedNFT 加 status 字段）

## ✅ 完成标准
- 个人页能看到 pending 状态的"铸造中"卡片
- failed 状态显示"铸造失败"
- success 不变

---

## Track A 完成后

1. 确认 `bash scripts/verify.sh` 全绿
2. 所有 step 已 commit
3. 等 Track B 完成
4. 进入 Track C
