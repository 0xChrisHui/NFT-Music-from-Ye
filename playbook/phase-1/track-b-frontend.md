# Phase 1 Track B — 前端体验

> 🎯 **目标**：把首页从"技术 demo"变成"有氛围感的作品入口"，加底部播放条和个人页骨架
>
> **前置**：Phase 0 全部完成，共享类型 `src/types/tracks.ts` 已就位
>
> **分支**：`feat/phase1-frontend`（在 worktree `../nft-music-frontend` 开发）
>
> **重要**：本 track 用假数据开发，不依赖后端 API。merge 后由 TA 替换为真实数据。

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| B0 | 首页改版：岛屿列表 + 引导动画 | 浏览器看到多个岛屿 |
| B1 | 底部播放条（全局固定） | 点击岛屿 → 底部出现播放条 |
| B2 | 个人页 UI 骨架 | 访问 /me 看到布局 |

---

# Step B0：首页改版 — 岛屿列表 + 引导动画

## 🎯 目标
首页从"单个呼吸圆"变成"多个岛屿"。数据用假数据（hardcode 3-5 条 track），布局有群岛感。首次访问有简单引导文字。

## 📦 范围
- `app/page.tsx`（改造）
- `src/components/archipelago/Island.tsx`（改造，接收 track 数据）
- `src/components/archipelago/Archipelago.tsx`（新建，岛屿列表容器）
- `src/data/mock-tracks.ts`（新建，假数据，merge 后删）

## 🚫 禁止
- 不调后端 API（用假数据）
- 不引入 framer-motion（用 Tailwind animate + CSS transition）
- 不做路由跳转（Phase 1 先单页）
- 不做响应式多列布局（先做好单列/简单网格）

## ✅ 完成标准
- 首页显示 3-5 个岛屿，每个有标题和颜色
- 首次访问有一行引导文字（如"点击岛屿，聆听音乐"）
- 点击岛屿能播放对应音频（复用 useAudioPlayer）
- 深色背景，有群岛氛围感
- 控制台 0 报错

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/
```

---

# Step B1：底部播放条

## 🎯 目标
全局固定在底部的播放条。点击岛屿后底部出现，显示当前播放曲目 + 播放/暂停按钮。切页不中断播放。

## 📦 范围
- `src/components/player/BottomPlayer.tsx`（新建）
- `src/hooks/useAudioPlayer.ts`（改造，支持全局状态）
- `app/layout.tsx`（修改，加入 BottomPlayer）
- 可能新建 `src/components/player/PlayerProvider.tsx`（音频状态 Context）

## 🚫 禁止
- 不引入音频库（继续用 Web Audio API）
- 不做播放列表 / 上下曲（Phase 2）
- 不做进度条拖拽（先只显示播放时长）

## ✅ 完成标准
- 点击岛屿 → 底部出现播放条，显示曲目名
- 播放条有播放/暂停按钮，点击切换
- 点击另一个岛屿 → 切歌，播放条更新
- 没有播放时播放条隐藏
- 深色风格，与首页统一

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/
```

---

# Step B2：个人页 UI 骨架

## 🎯 目标
新建 `/me` 页面，写好布局和样式，用假数据渲染。TA merge 后替换为真实 API 数据。

## 📦 范围
- `app/me/page.tsx`（新建）
- `src/components/me/NFTCard.tsx`（新建，单张 NFT 卡片）
- `src/components/me/EmptyState.tsx`（新建，无 NFT 时的提示）
- `src/data/mock-nfts.ts`（新建，假数据，merge 后删）
- `app/page.tsx` 或 `LoginButton.tsx`（加一个跳转到 /me 的入口）

## 🚫 禁止
- 不调后端 API（用假数据）
- 不做 NFT 详情弹窗（Phase 2）
- 不做分页

## ✅ 完成标准
- 登录后右上角能跳转到 /me
- /me 页面显示 NFT 卡片列表（假数据 2-3 条）
- 每张卡片显示 track 名称 + 铸造时间
- 无 NFT 时显示 EmptyState
- 未登录访问 /me 提示登录
- 深色风格统一

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/
```

---

## 完成后

TB 全部完成后：
1. 确认 `bash scripts/verify.sh` 全绿
2. commit 所有改动
3. 通知 TA："Track B 完成，可以 merge"
4. TA 执行 `git merge feat/phase1-frontend` 并解决冲突
