# Phase 2 — 合奏 + Arweave

> 🎯 **目标**：用户能和曲目合奏、录制、保存草稿（24h）、预览回放
>
> 🚫 **不包含**：乐谱 NFT 铸造（Phase 3）/ AI remix（Phase 3+）/ 社区钱包 / 空投
>
> ✅ **完成标准**：用户点击岛屿 → 进入合奏 → 键盘演奏 + 视觉反馈 → 录制 → 预览回放 → 保存草稿 → 草稿页看到倒计时

---

## 架构依据

- ARCHITECTURE.md 决策 8：Arweave 预上传所有静态资源
- ARCHITECTURE.md §十一：Phase 2 新增 `sounds` + `pending_scores` 表
- STACK.md：新增 `@ardrive/turbo-sdk`

## 前置条件

- Phase 1 全部完成 ✅
- Phase 1 review P0 修复 ✅

## 开发策略

**Step 0** 是技术验证关口（Gate），必须通过后才分线。

| 线 | 做什么 | 文件 ownership |
|---|---|---|
| Step 0 | Web Audio 键盘 spike | `src/spike/` (临时) |
| Track A | 后端：sounds 表 + Arweave + 草稿 API | `supabase/` `app/api/` `src/lib/arweave.ts` |
| Track B | 前端：合奏 UI + 录制 + 预览 | `src/components/jam/` `src/hooks/useJam.ts` `app/jam/` |
| Track C | 集成：接真实数据 + 草稿管理 + e2e | 两边都碰，但改动小 |

### 文件 ownership 规则

为避免 merge 冲突，明确划分：

**只有 Track A 能碰：**
- `supabase/migrations/`、`supabase/seeds/`
- `app/api/**`（所有 API route）
- `src/lib/arweave.ts`（新建）
- `src/types/`（新增类型需双方对齐后由 A 提交）

**只有 Track B 能碰：**
- `src/components/jam/**`（新建目录）
- `src/hooks/useJam.ts`、`src/hooks/useRecorder.ts`（新建）
- `app/jam/[trackId]/page.tsx`（新建路由）
- `src/data/jam-source.ts`（适配层）

**双方都不碰（C 才碰）：**
- `app/page.tsx`（首页加"合奏"入口）
- `src/components/archipelago/Island.tsx`（加合奏按钮）

## 时间预期

- Step 0：半天
- Track A + B 并行：2-3 天
- Track C：1 天
- 总计：3-5 天
