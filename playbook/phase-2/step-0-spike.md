# Phase 2 Step 0 — Web Audio 键盘 Spike（技术验证关口）

> 🎯 **目标**：验证"按键 → 发声 + 视觉动画"在 Next.js 里能流畅运行
>
> **这是 Gate**：通过 → 分线开发。不通过 → 降级方案后再分线。
>
> **串行执行**，不分线。

---

## 🎯 验证目标

1. 按下键盘 A-Z → 对应音效立刻播放（延迟 < 50ms）
2. 按键同时触发一个 CSS 视觉动画（圆圈扩散 / 颜色闪烁）
3. 多键同时按下不冲突
4. 在 Next.js 的 `'use client'` 组件中运行正常

## 📦 范围

- `src/spike/JamSpike.tsx`（临时文件，验证后删）
- `app/spike/page.tsx`（临时路由，验证后删）
- 不装新包，纯 Web Audio API + CSS

## 🚫 禁止

- 不录制、不保存、不调 API
- 不写正式组件（spike 代码全部是 throwaway）
- 不改现有文件

## ✅ 完成标准

- 浏览器打开 /spike，按 A-Z 键
- 每个键发出不同音高的声音（用 OscillatorNode 合成即可，不需要真 mp3）
- 每次按键屏幕上出现一个彩色圆圈并淡出
- 快速连按 5 次无卡顿
- 控制台 0 报错

## 🔍 验证命令

```bash
npm run dev
# 浏览器打开 http://localhost:3000/spike
# 按键盘，听声音看动画
```

## 决策点

**通过**：spike 延迟 < 50ms，体验流畅 → 按 Track A/B/C 分线开发。spike 文件删除。

**不通过**（延迟 > 100ms 或音频冲突严重）：
- 降级方案：减少同时发声数（最多 3 个），简化动画（只用 opacity 过渡）
- 降级后重新验证，通过后再分线

## ⏪ 回滚点

删除 `src/spike/` 和 `app/spike/` 即可。
