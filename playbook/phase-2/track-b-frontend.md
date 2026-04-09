# Phase 2 Track B — 前端：合奏 UI + 录制 + 预览

> 🎯 **目标**：用户能在浏览器里用键盘和曲目合奏，看到视觉反馈，录制并回放
>
> **分支**：`feat/phase2-frontend`（worktree）
> **与 Track A 并行**，用假数据 / 本地音频开发
>
> **前置**：Step 0 spike 验证通过
>
> **关键约定**：所有数据通过 `src/data/jam-source.ts` 适配层获取。
> Track C 替换为真实 API，页面组件不改。

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| B0 | 合奏页面骨架 + 键盘输入系统 | 按键有 console 输出 |
| B1 | 音效播放（26 键 → 26 音） | 按键听到不同声音 |
| B2 | 视觉反馈（按键动画） | 按键看到彩色圆圈 |
| B3 | 录制逻辑 + 预览回放 | 录完能回放自己的演奏 |
| B4 | 合奏页 UI 完善（开始/停止/保存按钮） | 完整合奏体验流程 |

---

## 数据适配层约定

```ts
// src/data/jam-source.ts
// Phase 2 Track B: 返回本地假数据
// Track C 替换为: fetch('/api/sounds') + fetch('/api/score/save')
export async function fetchSounds(): Promise<Sound[]> { ... }
export async function saveScore(data: ScoreData): Promise<{ scoreId: string }> { ... }
export async function fetchScorePreview(scoreId: string): Promise<ScoreData | null> { ... }
```

---

# Step B0：合奏页面骨架 + 键盘输入系统

## 🎯 目标
新建 `/jam/[trackId]` 路由，监听键盘 A-Z 输入。

## 📦 范围
- `app/jam/[trackId]/page.tsx`（新建）
- `src/hooks/useKeyboard.ts`（新建，键盘事件监听）
- `src/data/jam-source.ts`（新建，适配层）
- `src/data/mock-sounds.ts`（新建，假数据）

## 🚫 禁止
- 不调后端 API
- 不改 `app/page.tsx` 或 Island 组件（Track C 做）

## ✅ 完成标准
- 浏览器打开 /jam/xxx
- 按 A-Z 键，console 输出 `key: a` 等
- 页面显示曲目信息（从假数据读）
- 深色背景，居中布局

---

# Step B1：音效播放

## 🎯 目标
按键触发对应音效。基于 Step 0 spike 的验证结果实现。

## 📦 范围
- `src/hooks/useJam.ts`（新建，管理 AudioContext + 音效映射）
- 复用 `public/sounds/` 下的音效文件（如果 Track A 还没准备，先用 OscillatorNode 合成音）

## ✅ 完成标准
- 按 A 键 → 播放对应音效
- 按 B 键 → 播放不同音效
- 多键同时按不冲突
- 延迟 < 50ms

---

# Step B2：视觉反馈

## 🎯 目标
每次按键，屏幕上出现一个彩色图形并淡出。

## 📦 范围
- `src/components/jam/KeyVisual.tsx`（新建）
- `src/components/jam/JamCanvas.tsx`（新建，管理多个视觉元素）
- CSS 动画（不用 framer-motion）

## 🚫 禁止
- 不用 Canvas API（先用 DOM + CSS animation，性能够用）
- 不引入动画库

## ✅ 完成标准
- 按键 → 屏幕随机位置出现彩色圆圈
- 圆圈在 0.5-1s 内淡出消失
- 不同键不同颜色
- 快速连按 10 次不卡顿

---

# Step B3：录制逻辑 + 预览回放

## 🎯 目标
用户按"开始录制"后，记录所有按键事件（key + 时间戳 + 时长），停止后能回放。

## 📦 范围
- `src/hooks/useRecorder.ts`（新建）
- 修改 `app/jam/[trackId]/page.tsx`（加录制/回放 UI）

## ✅ 完成标准
- 点击"开始" → 录制状态，显示计时器
- 按键被记录为 `{ key: 'a', time: 1234, duration: 200 }`
- 点击"停止" → 录制结束
- 点击"回放" → 按照时间戳顺序重新触发音效 + 视觉
- 回放与原始演奏节奏一致

---

# Step B4：合奏页 UI 完善

## 🎯 目标
完整的合奏体验：背景音乐（track 原曲）+ 键盘合奏 + 录制 + 回放 + 保存按钮。

## 📦 范围
- `app/jam/[trackId]/page.tsx`（完善）
- `src/components/jam/JamControls.tsx`（新建，控制按钮组）

## 🚫 禁止
- 保存按钮只调适配层的 `saveScore()`（Track B 阶段是假保存）
- 不做草稿管理页面（Track C 做）

## ✅ 完成标准
- 进入合奏页 → 背景播放 track 原曲
- 键盘演奏叠加在原曲上
- 完整流程：开始 → 演奏 → 停止 → 回放 → 保存/重录
- 保存后显示"已保存"
- UI 深色统一，操作清晰

---

## Track B 完成后

1. 确认 `bash scripts/verify.sh` 全绿
2. 所有 step 已 commit
3. 通知 Track A："TB 完成，可以 merge"
