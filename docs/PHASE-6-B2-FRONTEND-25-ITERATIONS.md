# Phase 6 B2 — 前端 25 轮优化历程

> 时间跨度：2026-04-28 ~ 2026-05-01（v25 阶段总结 + v26-v62 续篇 + v63-v87 续篇 2 性能硬化）
> 起点：sound-spheres v6（force layout 36 节点）
> 终点（v87）：主页沉浸式视觉 + /test effects 沙箱 + JS/浏览器双层性能硬化（idle 25→55+ fps、zoom 11→30+ fps）
>
> 这份文档写给"以后回来翻看 / 想知道为什么这么做"的自己。
> 决策的"为什么"看 `JOURNAL.md` 2026-04-29 / 04-30 段；这里是叙述 + 经验 + 审美。
> v26-v62 续篇 / v63-v87 续篇 2 见文末，与本节的 v6-v25 同源风格。

---

## 起点 vs 终点

| | 起点 | 终点 |
|---|---|---|
| 主页布局 | 70vh + max-w-6xl 居中 | fixed inset-0 全屏可拖 |
| 球网络 | 5 cluster 均匀分布 | 7 deterministic cluster + 22% outlier，散点格局 |
| 链接 | 全节点稠密 cross-link（~120 边） | 仅同 cluster 内（~40 边） |
| 按键反馈 | useKeyVisual（彩色圆淡出） | 26 键 SVG 动画（patatap 移植） |
| 播放高亮 | 圆变白 + 暂停 icon | 日食模式（黑月 + 减淡白光环 + 内核高亮环 + Portal 最上层） |
| 配色 | A Portra / B 复古 / C 工业金属 | A Portra / B 莓紫雾蓝 / C 莓紫绿粉蜜蜡黄 |
| 文案 | "我的乐谱 / 素材收藏 / 钱包地址" | "我的唱片 / 音乐收藏 / 我的音乐" |
| 背景 | 纯黑 | 自动 + 手动触发的白色涟漪 + 推球互动 |

---

## 25 轮按主题分组

### 主题 1：sound-spheres 视觉调优（v4-v10，约 7 轮）
**问题**：开局抖动、节点撞团、拖动后凝固、配色不准
- v4-v5：基本布局 + 防飞出 + 加连线
- v6：聚落分布 + 减弱抖动 + 首次秒开
- v7-v8：用户改配色 + 修拖动凝固 + 修复矩阵 6 项参数
- v9-v10：拉开间距 + 工业金属配色 + 拖动节点跳过 clamp

**核心决策**：
- 拖动时跳过 clamp（让节点能拖出 PAD 边界，自由感）
- alphaTarget baseline 0.008（极弱漂浮，不"心跳"）

### 主题 2：patatap 动画 Two.js 移植（3 轮，最终搁置）
**Phase 1**：Two.js + tween.js 基础设施 + corona demo（B 键）
**Phase 2**：3 个 worker agent **并行**移植 21 个动画 → 26 键独立映射
**结局**：用户测试发现"做的太糟糕，非常多 bug"，整体搁置

**关键教训**：
- 工程"完成度"不等于用户接受度
- 20 个 effect 文件留作 dead code（不删，防回退），等独立清理时一次砍

### 主题 3：SVG 动画引擎接入（v18 重构 + 配色多次调整）
切到 `references/aaaa/patatap-engine.jsx` 风格 — 纯 SVG + RAF + 12 动画函数：
- 12 个移植：bubbles/clay/confetti/corona/moon/pinwheel/pistons/prisms/squiggle/strike/wipe/zigzag
- 补 8 个缺失：flashes×3 / glimmer / spiral / splits / suspension / timer / ufo / veil
- 拆 multi-variant：pistons / prisms / flashes 各 3 变体 → 9 键
- 26 键独立映射（QWERTY 三排定位严格对齐 patatap hash）

**核心决策**：
- 黑底背景 + palette.black = rgb(0,0,0) 完全看不见 → 统一改 CREAM #E8D8B8
- B/C 配色多次推倒重来：海洋深邃 → 春日花园 → 暮色霓虹 → 莓紫绿粉蜜蜡黄

### 主题 4：/test 沙箱与日食模式（4 轮 + Portal 修复）
**沙箱目的**：试新方案不影响主页 — 后期同步到主页
**日食 v1-v4**：
- v1：黑圆 + 白光晕 + 暂停键
- v2：sim 不重启（playingId 用 ref，避免 useEffect 重建撞乱位置）+ 连线/hover 改白
- v3：z-index 强保证 + 散点聚落 + 拖走不回弹 + 光晕柔化 + 连线日食时隐藏
- v4：React **Portal** 跳出 stacking context（解决日食被按键动画遮）+ 内核高亮细环

**Portal SSR 修复**（紧急）：
- 症状：prod 首次进入主页点圆，日食不显示 → 圆变白；进 /me 再回来 OK
- 根因：`typeof window === 'undefined'` 早 return null，hydration 锁定 null，Portal 永不挂
- 修法：`useSyncExternalStore` 提供 server/client 双快照，hydration 后自动 re-render 挂 Portal

### 主题 5：主页同步 /test → 浮层布局
**z-stack**：
| 层 | 内容 | 备注 |
|---|---|---|
| z-0 | BackgroundRipples + Archipelago fullscreen | 球可拖 |
| z-30 | ABC tabs（左侧 vertical）+ TestJam UI | 操作面板 |
| z-40 | SvgAnimationLayer 按键动画 | pointer-events:none |
| z-50 | DraftSavedToast / TestJam 容器 | |
| z-60 | 顶栏（标题 + LoginButton "我的音乐"）| 可点 |
| z-9999 | EclipseLayer（Portal 到 body） | 真正最上层 |

### 主题 6：聚落算法的核心修复（v15 重写）
**用户洞察**："link 的拉力会撕裂聚落 — 是不是因为 link 和 cluster 算法不一致？"
**根因确认**：generateLinks 用 week hash，setupSimulation 用 Math.random，两套独立 → 同 cluster 节点之间没 link，跨 cluster 反而被 link 拉着不肯进自己 cluster

**修法（v15 deterministic 重写）**：
1. `getNodeCluster(node)` 用 id hash 算 cluster index（-1 = outlier）
2. `generateLinks` 仅在同 cluster 内生成（拉力方向 ≡ cluster anchor 方向）
3. `setupSimulation` 用同一 `getNodeCluster` 决定每节点 anchor
4. Anchor 位置用 **Halton 低差异序列**（数学保证 7 个点均匀分布、互相远离）

效果：力一致 + 聚落清晰 + 不再"缠绕"。

### 主题 7：背景涟漪 v15 → v25（10+ 轮迭代，最磨人的一段）

**演进**：
- v15：第一版随机白色涟漪
- v16-v17：太亮 → 太淡 → 闪烁的反复平衡
- v18：双发 + 邻近 burst（45% 概率连发 1-2 个邻近涟漪）
- v19：opacity 0.27 + 慢扩散（duration ×1.7）+ 放大优化
- v20：MAX_RIPPLES + zoom > 1.4 时 sim alphaTarget(0)
- v21：点击空白触发涟漪 + 涟漪推球（极弱 force 0.18）
- v22：MAX_AUTO=4 / MAX_TOTAL=8 双上限 + 末段 5s 慢淡出
- v23：起始 scale 0.05 + opacity 0.55（点击立即可见）+ CSS .zoom-large 暂停 sphere ripple
- v24-v25：手动点击强反馈 keyframe（前 2s 鲜明，逐渐渐变到普通涟漪）

**核心决策**：
- BackgroundRipples 用 **ref-based DOM**（`appendChild/removeChild`），不用 setState — 避免 React reconciliation 与 sphere 同帧 paint 抢预算
- MAX_TOTAL hard cap 防 GPU layer 累积闪烁
- 双上限：自动 4 / 手动允许叠到 8（手动反馈优先）
- transform 用两端单 stop ease-out（多 stop 卡顿）
- stroke-width / stroke-opacity 走 CSS keyframe（SVG attr 不参与 keyframe）

### 主题 8：性能闪烁排查链（贯穿后期）

**症状演化**：
1. 首次进入 → 偶发闪烁
2. 5s 后开始持续高频闪烁
3. 放大到 ~20 球大小再次闪烁

**排查链**：
| 怀疑 | 证据 | 修法 | 是否解决 |
|---|---|---|---|
| React reconciliation | 5s 后才闪 | ref-based DOM | 部分 |
| GPU layer 累积 | 涟漪堆积太多 | MAX_RIPPLES 限制 | 部分 |
| 大尺寸 filter cost | 放大才闪 | glow stdDeviation 5/10 → 2/4 | 部分 |
| sim alpha jitter | 持续 60Hz tick | zoom > 1.4 alphaTarget(0) | 部分 |
| ripple infinite anim | 36×3=108 个无限动画 | CSS .zoom-large pause sphere ripple | 解决放大闪烁 |

终态：正常 view + 适度放大 + 多涟漪叠加都稳定。极端放大或多重叠加可能仍闪 — 已是 SVG-based 方案的实践上限。

---

## 续篇：v26-v62 —— effects 体系沙箱化（2026-04-29 ~ 04-30）

v25 总结成稿后又跑了 35+ 轮迭代。前段（v26-v35）已 commit `b4698de`；后段（v36-v62）尚未 commit — 把 17 个"假 3D"视觉效果做成可分享 URL、可复选框对比的沙箱体系。

### v26-v35：散点收紧 + Tab + dead code 砍光（committed b4698de）

- **v26**: ABC 三 tab（1/2/3 切 group）+ B/C 配色再调 + zoom 缩回 sim 冻结修复（缩回时 `restart()`）
- **v27-v32**: 初始布局缩到中心 1/9（边缘空洞修复）+ outlier 散点 Math.random + cluster 划分改 random pool（每次刷新不同 — 推翻 v15 deterministic）+ collide 宽松到 `r×1.1+8`
- **v33-v34**: 小 cluster (size≤2) 30% 漂外圈 + zoom 时 `alphaTarget 0.003` 不冻 sim（让涟漪推球继续生效）+ `archipelago:reset` 切 group 时清屏 + 等 2s 球稳后 spawn
- **v35**: zoom 冻结阈值 1.4 → 2.5；/test 同步主页（BackgroundRipples + DraftSavedToast + 左侧 TestJam）+ animations/ + jam/HomeJam + KeyVisual 搬 `references/dead-code/` + 卸 `two.js` + `@tweenjs/tween.js`

**核心决策**：
- cluster 划分从 deterministic 改回 random（推翻 v15）— 每次刷新换 cluster 让主页有新鲜感，覆盖 v15 当时"力一致性"的强约束
- zoom 冻结阈值放宽 — 涟漪推球功能需要 2.5 范围才看得见

### v36-v62：effects 中央化 + 17 effect 沙箱（uncommitted）

#### v37-v39：effects 体系中央化

**问题**：v35 之前每个视觉调整散在 SphereCanvas 内，无法对比开/关效果，无法分享 URL。

**修法**：
- v37/v38：focus（焦平面景深）+ tilt（鼠标视差）落地为主页基础视觉
- v39：`effects-config.ts` 17 effect 中央开关 + `EffectsPanel.tsx`（右下角折叠浮层 FX·N）+ URL 双向同步（`parseEffectsFromURL` / `effectsToQuery`，仅写非默认值，链接简短）
- SphereCanvas / Archipelago 接 `effects: EffectsConfig` prop，每个 effect `if (effects.xxx)` 一刀切，关闭时 dead branch 不参与渲染

**核心决策**：默认只开 focus + tilt — "画面基础质感" vs "wow 试验"分层；混着开就乱。沙箱挂的 15 个等 tester 反馈再决定哪个进主页默认值。

#### v40-v59：17 effect 实装 + 子目录按职责拆

archipelago/ 28 文件按职责进 5 个子目录：

| 子目录 | effect | 一句话 |
|---|---|---|
| `shading/` | glass / specular / tint | 球面 radial gradient / 鼠标高光跟随 / z-color tint（远→背景色） |
| `geometry/` | wrap / fisheye / perspective | 球面投影压扁 / 鼠标镜头放大 / 一点透视沿 z 飞行 |
| `motion/` | breath / comet / sphereRipple / trail / lens-flare | z 呼吸 / 彗星 / 球涟漪（CSS infinite）/ motion blur 尾迹 / 播放星芒 |
| `ambient/` | fog / stars / aurora | 远雾 / 星尘 / 极光（独立背景层） |
| `interact/` | edgeBend / fly | 链路 Bezier 弯（z 差→弧度）/ 点击球时相机飞跃 |

`hooks/` 子目录从 root 拆出 — `use-sphere-zoom` / `use-sphere-z` / `use-sphere-sim` / `use-mouse-tilt` / `use-wave-events`。

**核心决策**：archipelago/ root 28 文件触发 8 文件硬线 → 按子目录拆（meta 决策走 memory `feedback/auto_split_files`）。root 只留 7 个核心：Archipelago / SphereCanvas / SphereNode / EclipseLayer / SphereGlowDefs / effects-config / sphere-config + sphere-sim-setup。

#### v60-v62：彗星体系深加工

- **v60**: 彗星日食模式 — 点击彗星进入日食状态（替代圆点击日食），`cometEclipseActive` 通过 `comet:eclipse-changed` window event 广播给 SphereCanvas
- **v61**: 3 处统一改动
  - 拖尾 14 → 70（5× 长，约 1.2s 历史轨迹）
  - perspective 联动 — CometSystem 收 `zoomKRef` / `vanishRef` / `perspective` props，RAF tick 内对 head + 每 trail 节点 `pow(k, 0.6 + z×1.0)` 投影 → zoom 时彗星跟球同步缩放
  - 统一日食管理 — SphereCanvas 抽 `anyPlaying = playingId || cometEclipseActive` 单一布尔，传给 SphereNode（dim 球）/ CometSystem（dim 非 eclipse 彗星到 15% 透明度）/ EclipseLayer（显隐）三处
- **v62**: 彗星 size 公式化重写 — 用户洞察"彗星大小应该是球小球的 X 到 1.2X，且随 zoom 变化"
  - 推翻 v60-v61 的 `HEAD_R` 常量 + 跟彗星自身 z 缩放
  - 新公式：`r = SIZE_BASE × sphereMinScale × sizeFactor`，其中 `SIZE_BASE = 9 × 0.7 = 6.3`（球 minR × z=0 scale）/ `sphereMinScale = pow(k, 0.6)`（perspective 时）/ `sizeFactor` 每彗星 spawn 时随机 1.0-1.2 固定
  - **关键决策**：彗星视觉尺寸跟"球小球当前视觉半径"走，**不跟彗星自身 z**。z 已被位置 / opacity / scale 用掉，再绑 size 会让远彗星看不见，违背"彗星永远是视觉前景"的设计意图

### 状态管理结构（v61 起统一）

```
playingId (PlayerProvider)        ──┐
                                    ├─→ anyPlaying (SphereCanvas state)
cometEclipseActive (window event) ──┘                │
                                                     ├─→ SphereNode dim
                                                     ├─→ CometSystem anyEclipse prop
                                                     └─→ EclipseLayer 显隐
```

未来加 eclipse 来源（其他 effect）只需汇聚到 `anyPlaying` 一处即可。

### 双线并行决定（2026-04-29 21:54）

用户提出"修改 26 键盘动画"，评估后两线目录隔离干净：
- 26 键盘动画线：`src/components/animations-svg/`
- sphere effects 线：`src/components/archipelago/`
- 共享面 3 处：`app/test/page.tsx`（错开改）/ `app/globals.css`（手动合并）/ 键盘事件（a-z vs ←→/space — `e.key.length !== 1 || !/[a-z]/.test(key)` 已在 SvgAnimationLayer:33 做护栏）

**约定**：每条线独立 commit prefix（`feat(svg-anim)` vs `feat(sphere): vNN`），不开分支（保持 main 直推 + JOURNAL 不乱）；26 键盘动画完成前 SvgAnimationLayer 仅 /test 用，反复改不影响主页。

---

## 续篇 2：v63-v87 — 性能硬化 + /test → / 覆盖（2026-04-30 ~ 2026-05-01）

> v62 后用户决定把 /test sandbox 视觉迁回主页。表面只是几行 prop 改动，实际触发了一连串"FPS 卡到 < 10 → 50+ 稳定"的诊断 / 误诊 / 重诊迭代。
>
> 整段经历最终凝结成一条核心认知：**JS 层优化和浏览器内部渲染管线是两个独立的世界**——JS cache 命中不代表浏览器 SVG filter 缓存命中。

### 主题 1：/test → / 覆盖 + 设备响应（v63-v68）

迁移 `/test sandbox` 视觉到主页，同时保留 sandbox 长期使用：

- 新建 `useResponsiveDefaultEffects` hook（`matchMedia('(max-width: 767px)')`）：服务端 + 首次 client render 给 DESKTOP_EFFECTS，mount 后命中手机宽度切 MOBILE_EFFECTS。用 `useSyncExternalStore` 解 SSR
- `DESKTOP_EFFECTS` 全开 10 effect / `MOBILE_EFFECTS` 仅留 comet/stars/aurora/bgRipples 4 个氛围 effect — 桌面体验上限，手机体验下限
- /test 加 `metadata.robots = { index: false, follow: false }` 阻止搜索引擎收录
- BackgroundRipples 改受 `effects.bgRipples` 控制（统一 / 和 /test）
- 新建 `PerfHUD` 组件：rAF 1s 滚动 FPS + 1s 内最长帧 ms，绿/黄/红三色编码

### 主题 2：JS 层 perf 第一轮（v69-v75）

诊断起点：用户报全 FX 时 FPS < 10。

四项改动：
1. **删 `transition: filter`** — CSS transition 配合 JS 每帧改 filter，浏览器永远在算插值 + 离屏 GPU layer 重做。性能反模式
2. **日食模式跳过 35 个非播放球的 transform 写入** — opacity 0 看不见，写 transform 是浪费
3. **focus filter throttle 到 15Hz + 值 cache** — 量化 blur 到 0.1px 精度，值变化时才 setAttribute
4. **删 use-sphere-zoom 里 d3.zoom 回调里的 applyFocusBlur** — wheel 事件 ~100Hz × 36 球 setAttribute 是缩放掉帧元凶

成果：JS 层每秒 setAttribute 从 ~3600 → ~200。但用户实测仍卡——意味着瓶颈不在 JS 层。

### 主题 3：A/B/C 三种 glow 方案探索（v76-v80）

针对"无开关的 SVG glow filter 在 zoom 时占 GPU 30-60%"问题：

- **A 方案（已实施）**：filter region 180% → 150%，stdDeviation 2 → 1.2。GPU 卷积像素工作量降到 ~24%
- **B 方案（未实施）**：zoom > 2.5 时关 glow + hysteresis 防震荡。设计完成、未编码
- **C 方案（实装但用户视觉拒绝）**：用 `<radialGradient>` 替代 SVG `<filter>`，`currentColor` 让一份 gradient 服务所有颜色。**理论性能优势 ~144x**（gradient 1 op/px vs feGaussianBlur 144 ops/px）。但用户偏爱 SVG filter 的"真 Gaussian"质感，最终通过 FX 面板 `gradientGlow` toggle 保留为可选

教训：性能再好的方案打不过用户审美，必须做成 toggle 而不是替换。

### 主题 4：J + K + L 性能基础设施（v81-v83）

三个 FX 面板开关 + 一个自动机制：

- **viewportCull (J)** — 缩放时屏幕外的球 `display:none`，状态 cache 防重复 setAttribute
- **adaptiveQuality (L)** — FPS < 30 持续 2s → 按降级表 force-off（comet → sphereRipple → layerWave2 → fog → aurora → stars）；FPS > 55 持续 15s → 恢复最近一个被关的（hysteresis）；用户主动关 = 永远关
- **彗星对象池 (K)** — trail dots/lines 改 SVG 元素复用，每帧 `pool.reset()` 隐藏未用，不再 createElement+appendChild。理论省 70-85% comet 重建成本

档案结构调整：archipelago/ 顶层撞 8 文件硬线 → 新建 `archipelago/render/` 子目录，抽 5 个 helper（render-helpers / render-links / render-eclipse-moon / svg-pool / render-comet-trail）。

### 主题 5：白盒优化绿色 4 项（v84-v85）

三 Agent 头脑风暴（CEO + 白帽黑客 + 底层架构师）筛出"低成本立即做"项：

- **Page Visibility 守卫** — BackgroundRipples / StarsBackground 的 setTimeout 加 `document.hidden` 早 return（rAF 自动暂停，setTimeout 不会）；PerfHUD 检测 dt > 100ms 重置统计窗口（避免 tab 恢复假 0fps）
- **CSS `contain: layout style`** 给 sphere `<g>`（不用 paint 避免裁剪 glow halo）
- **rAF 闲时降频** — 5s 无键鼠输入 → DOM 更新半频；render-helpers 加全局 `lastActivityTime` 模块状态
- **content-visibility skipped** — 评估后 SVG `<g>` 上行为不确定 + 球容器 fixed 全屏从不滚出视口，无适用场景

实测：用户反馈"几乎没什么变化"。**JS 层优化达到 diminishing returns**——不是优化无效，是真正的瓶颈在浏览器渲染层。

### 主题 6：突破口 — 浏览器内部渲染管线（v86-v87）⭐

**诊断转折点**：用户报具体数字 + toggle 排查：

| 状态 | FPS |
|---|---|
| Idle 不动 | 25-35（baseline 就被 choke）|
| Zoom 最大 | 11-15 |
| 关 sphereRipple | +15 fps（idle 主敌）|
| 关 perspective | +20 fps（zoom 主敌）|

**核心洞察**：JS 层 filter cache 不影响浏览器内部 SVG filter 缓存。即使我们不调 `setAttribute('filter', ...)`，浏览器仍因 `transform="scale(...)"` 微变而每帧重栅格化 filter。

三刀（10 行改动解决）：

**1. 删 z 抖动**（`use-sphere-sim.ts` + `render-links.ts` + `render-eclipse-moon.ts`）

```ts
// 之前
const z = (zMap.get(n.id) ?? 0.5) + Math.sin(now / 3000 + ...) * 0.05;
// 之后
const z = zMap.get(n.id) ?? 0.5;
```

之前每球 z 加 ±0.05 sin 漂移给"呼吸感"。这导致 `persp(...)` 的 scale 每帧微变（比如 1.500 → 1.501）→ SVG `<filter>` 浏览器内部缓存失效 → 每帧重跑高斯卷积。删掉抖动 → z 恒定 → scale 恒定 → filter cache 命中 → idle 时 GPU 几乎不再跑 feGaussianBlur。

视觉损失：球失去 ±0.05 z 微抖（呼吸感肉眼几乎不可察觉）。

**2. ripple 动画简化**（`globals.css`）

```css
/* 之前：stroke-width 动画化触发主线程重绘 */
0%   { transform: scale(1);   opacity: 0.44; stroke-width: 0.3; }
20%  { stroke-width: 2.5; }
100% { transform: scale(1.6); opacity: 0; stroke-width: 2.5; }

/* 之后：纯 GPU-friendly */
0%   { transform: scale(1);   opacity: 0.44; }
100% { transform: scale(1.6); opacity: 0; }
.ripple-c { stroke-width: 0.6; /* 静态窄宽度 */ }
```

`stroke-width` 不是 GPU-only 属性，每帧改触发主线程重绘。108 球 × 60Hz 重绘 = idle -15 fps。改成只动画 `transform` + `opacity`（合成线程跑），stroke-width 静态 0.6（用户偏好窄宽避免视觉跳动）。

**3. perspective max 8 → 4**（`render-helpers.ts`）

```ts
const factor = Math.min(4, Math.pow(k, 0.6 + z * 1.0));
```

zoom 最大球放大 4x（不再 8x）。filter 区域面积 64x → 16x → **4 倍 GPU 工作量减少**。视觉变化：zoom 最大不再撑屏，反而更内敛。

**成果**：

| 状态 | 之前 | 之后 |
|---|---|---|
| Idle 不动 | 25-35 fps | **50-60+** |
| Zoom 最大 | 11-15 fps | **30+** |

### 状态总结（v87）

```
archipelago/
├── effects/        (17 effect 实装 — 与 v62 同)
├── hooks/          (8 文件: v87 新增 use-responsive-effects + use-adaptive-effects)
├── render/         (5 文件: v87 全新子目录)
│   ├── render-helpers.ts        (TILT_PX / tiltCoef / persp / 全局活动追踪)
│   ├── render-links.ts          (sim links 渲染抽出)
│   ├── render-eclipse-moon.ts   (月亮 transform 更新抽出)
│   ├── svg-pool.ts              (通用 SVG 对象池工厂)
│   └── render-comet-trail.ts    (comet trail 用 pool 渲染)
└── 8 个顶层文件
```

`effects-config.ts` 新增字段：
- `gradientGlow`（C 方案，默认 false）
- `viewportCull`（J，默认 true）
- `adaptiveQuality`（L，默认 true）

新组件：`src/components/PerfHUD.tsx` — 左下角 FPS HUD。

---

## 经验教训（写给自己）

### 1. 用户感知 > 工程"完成度"
Two.js 移植 21 动画技术上是成功的，但用户反馈 bug 多就该立刻搁置。不要陷入"我做的对所以坚持"陷阱。

### 2. 调参与用户感知协调要多次迭代
涟漪 opacity / size / 速度 / 频率反复调了 10+ 轮才稳定。每轮只调 1-2 参数，让用户感知变化更精准。

### 3. SSR / hydration 的隐藏陷阱
`typeof window === 'undefined'` 在 prod 是隐患（hydration 锁定 null）。
标准做法：`useSyncExternalStore` 给 server/client 双快照（false/true），hydration 后自动 re-render。

### 4. SVG attribute ≠ CSS animation
`setAttribute('stroke-width', '2')` 后 CSS keyframe 改不动它。
想 keyframe 控制 SVG 表现属性必须不 setAttribute，让 CSS 完全接管。

### 5. transform multi-stop ≠ 平滑
keyframe 每个 stop 之间是独立 ease-out。多 stop 拼接 = 每 stop 速度归零再启动 = 卡顿。
平滑过渡的正确做法：transform 用两端 stop（0% / 100%），中间属性走 keyframe 渐变。

### 6. GPU layer 是稀缺资源
每个 `transform: scale + transform-box: fill-box` 创建独立 GPU 合成层。
浏览器 layer 上限（Chrome ~256），超了退化 CPU paint → 闪烁。
解法：限 MAX 数 + 关闭非必要动画（zoom 时用 CSS animation-play-state pause）。

### 7. D3 sim 与渲染层的耦合
sim alphaTarget baseline 让节点持续 jitter，每帧 setAttribute('transform')。
与 GPU 合成 paint 同帧争抢，性能压力大。
缩放时 alphaTarget(0) 让 sim 静止 = 大幅减 paint 频率。

### 8. 聚落算法的"力一致性"原则
D3 force 系统中 link / cluster / charge 多力共存。
如果 link 把 A 拉向 B（不同 cluster），cluster 把 A 拉向自己 cluster anchor，A 永远在中间。
解法：让 link 仅在同 cluster 内生成（拉力同方向），用 deterministic hash 算 cluster 归属让 link 和 sim 共识。

### 9. ref-based DOM > setState（高频更新场景）
涟漪 spawn / remove 1-2/秒，setState 触发 React 协调全树。
直接 DOM `appendChild / removeChild` 走原生 DOM API，零 React 开销。
适用：动画、ticker、不需要 React 状态管理的场景。

### 10. 多 agent 并行的边界
Phase 2 用 3 个 worker agent 并行移植，但都因 8 文件硬线撞墙暂停。
教训：spawn 前先确认 hook / 硬线，prompt 里告诉 agent 撞线该怎么做（停下报告 vs 自动豁免）。

### 11. Math.random in render 被 React 19 ESLint 阻止
`react-hooks/purity` rule 阻止 useMemo body 用 Math.random。
解法：deterministic seed（基于 id hash）或者把随机搬到 useEffect 内。

### 12. 文件硬线触发时的元决策
单文件超 220 行 → 拆（自动）。
目录超 8 文件 → 拆子目录 / 加豁免（元决策必须问用户）。
本次 effects/ 加豁免（与 src/app/api/ 同类天然 fan-out）；archipelago/ 紧凑 JSX 压缩到 200。

### 13. JS 层缓存 ≠ 浏览器内部缓存（v87 核心教训）
v77-v83 多轮 filter cache 都是 JS 层避免重复 setAttribute。但浏览器渲染 SVG `<filter>` 时，决定是否重栅格化看的是元素的实际 transform/scale 值。哪怕 0.001 的差也会浏览器层 cache miss，重新跑高斯卷积。
解法：保证元素 transform 在 idle 时完全恒定（删 sin 抖动）。
这是 v87 突破口最关键的认知。前 5 轮所有"filter 节流 + cache"都没用，因为它们没动到浏览器看到的属性。

### 14. CSS 动画属性的 GPU/CPU 边界
- 纯 GPU（合成线程跑，主线程零参与）：`transform`、`opacity`
- 触发重绘（主线程必须参与）：`stroke-width`、`width`、`height`、`color`、`margin`、`border-radius`、`top/left`...

原 ripple 动画化 `stroke-width 0.3 → 2.5` = 108 球 × 60Hz 主线程重绘 = idle -15 fps。
铁律：高频/无限循环动画**只用** transform + opacity；其他属性该静态就静态。
副推论：JS 高频改 element style 也只动这两个属性。

### 15. 诊断纪律：measure-first
v77-v85 多轮优化看似合理但实际未触及瓶颈。直到用户报具体数字 + 一项一项 toggle 排查（关 sphereRipple +15 fps / 关 perspective +20 fps），才精确定位到真正凶手。
教训：开始优化前花 3 分钟让用户跑 toggle 排查，比埋头改 100 行代码有效 10 倍。
不要相信"应该贵"的直觉——profile 给真相。

### 16. "微不足道的视觉变化"陷阱
±0.05 的 z 漂移在 3 秒周期里，肉眼几乎察觉不到。但浏览器渲染管线"看到"它每帧都在变化。
经验：**任何 60Hz 改变的视觉参数都要审计**。
权衡公式：(美观加分 × 用户察觉概率) vs (每帧渲染成本 × 60 × 帧数)。
原 z 抖动美观加分接近 0，每帧成本却让 36 球的 SVG filter 全部 cache miss。删除收益远超损失。

### 17. 三 Agent 头脑风暴的边界
v85 用 CEO（产品 ROI）+ 白帽黑客（边界 trick）+ 底层架构师（系统重构）三视角输出 30+ 想法。落地"绿色 4 项"后用户报"几乎没变化"。
教训：头脑风暴产生想法的多样性，但落地前必须 profile 验证瓶颈。否则会做出技术正确但不解决问题的优化。
agent 的价值是开拓视野（让我看到了 Page Visibility / contain / 闲时降频这些角度），但具体哪个有用还得用真实数据验证。

---

## 审美原则（本次确立）

### 黑底 + 米黄主调 + 白色高光
- 项目背景永远是 `#000`，所以 palette.black = rgb(0,0,0) 在该背景看不见
- 统一改 CREAM `#E8D8B8` 作为黑色等价
- 涟漪 / 高光 / 暂停键用纯白：强反馈用 white opacity 0.95，柔和用 0.27

### 涟漪节奏：起小、立现、慢淡
- 起步 10-20px（不是从 0）让"小水滴"立刻可见
- duration 14-20s 慢扩散，模拟水波物理
- 末段 5s 多 stop 慢淡（70% / 82% / 92% / 100%），避免突然消失
- 手动触发 = 强反馈：起始 stroke-width 2.6 / opacity 0.95，2s 渐变到普通值

### 聚落 > 均匀分布
- 5-8 个小聚落（每个 3-5 节点）+ 22% outlier 散点 > 全图均匀
- Halton 低差异序列保证 anchor 之间最小距离
- cluster 拉力 0.20 / outlier 拉力 0.018（差 11×）让聚落清晰

### 链接拓扑：少而有结构
- 旧：~120 条边（全节点稠密 cross-link）→ 缠绕
- 新：~40 条边（仅同 cluster 内 + 完全无跨 cluster）→ 视觉清晰

### 交互反馈：立即 + 平滑
- 点击播放 → 日食立即出现（不延迟）
- 点击空白 → 涟漪立即可见 + 前 2s 强反馈
- 拖动后弱回弹（保留流动感，不完全冻结也不立即弹回）

### 性能即视觉
- 闪烁 = 视觉灾难，宁可减视觉换稳定性
- CSS `.zoom-large` 暂停 sphere ripple animation（用户在缩放状态下不需要 ripple 持续）
- 双上限：自动 4 / 手动 8（保护手动反馈优先级）

---

## 留存清单（dead code，已在 v35 搬走）

commit `b4698de` 已搬到 `references/dead-code/` + 卸 deps：
- ~~`src/components/jam/HomeJam.tsx`~~ → `references/dead-code/jam/HomeJam.tsx`
- ~~`src/components/jam/KeyVisual.tsx`~~ → `references/dead-code/jam/KeyVisual.tsx`
- ~~`src/components/animations/`~~ → `references/dead-code/animations/`（20+ Two.js effect + AnimationLayer + 基础设施）
- ~~`two.js@0.8.23` + `@tweenjs/tween.js@25.0.0`~~ → `npm uninstall` 已执行

剩余未删（待评估）：
- `src/hooks/useKeyVisual.ts` — 仍在 hooks/，`grep` 无引用，下轮可删
- `references/dead-code/` 整棵 — 等独立清理 pass 一次性 `git rm -r`

---

## 关键文件 cheat sheet

| 文件 | 作用 |
|---|---|
| `app/page.tsx` | 主页 z-stack 浮层布局 |
| `src/components/archipelago/Archipelago.tsx` | 容器（fullscreen prop + 36 首 audio prefetch） |
| `src/components/archipelago/SphereCanvas.tsx` | 主图（D3 sim + 节点渲染 + 日食 sync + wave push） |
| `src/components/archipelago/SphereNode.tsx` | 单球（hover / ripple / 心形 / 日食 hover 改白） |
| `src/components/archipelago/sphere-config.ts` | 配色 + getNodeCluster + Halton + generateLinks（同 cluster 内连） |
| `src/components/archipelago/sphere-sim-setup.ts` | D3 force + drag（阈值 8）+ pushSpheresByWaves |
| `src/components/archipelago/EclipseLayer.tsx` | 日食浮层（Portal + useSyncExternalStore + 内核高亮环） |
| `src/components/archipelago/effects-config.ts` | **v39** effect 中央开关 + DEFAULT_EFFECTS + URL 双向序列化；**v87** 加 DESKTOP/MOBILE 分流 + gradientGlow / viewportCull / adaptiveQuality |
| `src/components/archipelago/effects/{shading,geometry,motion,ambient,interact}/` | **v40-v62** 17 effect 实装按职责分子目录 |
| `src/components/archipelago/effects/motion/comet-system.tsx` | **v60-v62** 彗星基础 + **v87 K** trail 走对象池 |
| `src/components/archipelago/hooks/` | **v36+** 8 个 hook：use-sphere-zoom / -z / -sim / -mouse-tilt / -wave-events / -layer-wave / **v87** -responsive-effects / -adaptive-effects |
| `src/components/archipelago/render/` | **v87** 子目录：render-helpers / render-links / render-eclipse-moon / svg-pool / render-comet-trail |
| `app/test/EffectsPanel.tsx` | **v39** 右下角折叠浮层（FX·N 计数 + 复选框分组）；**v87** 加渲染组 3 项 |
| `app/test/layout.tsx` | **v87** noindex metadata（保留 sandbox 但不让搜索引擎收录） |
| `src/components/PerfHUD.tsx` | **v87** 左下角 FPS HUD（rAF 1s 滚动 + 三色编码 + dt > 100ms 重置守卫） |
| `src/components/animations-svg/engine.ts` | 26 键 → 12 动画函数映射 |
| `src/components/animations-svg/effects/*.ts` | 12 个 SVG 动画（含 helpers / palettes / types） |
| `src/components/BackgroundRipples.tsx` | 背景涟漪（auto + 手动 + spawn 时 dispatch wave event） |
| `src/components/jam/TestJam.tsx` | 简化 jam（无旧 keyVisual） |
| `src/components/jam/DraftSavedToast.tsx` | 草稿保存浮层（监听 jam:draft-saved 事件 + 滑入动画） |
| `app/globals.css` | ripple-out / bg-ripple-out / bg-ripple-manual / jam-toast-slide / .zoom-large |

---

## 下一步建议（优化方向）

按优先级（v87 后刷新）：

1. **commit v63-v87** — 当前未提交的 /test → / 覆盖 + 性能硬化 + render/ 子目录拆分 + 三档优化（J/K/L + 绿色 4 项 + 突破口三刀）应分多个 prefix commit
   - `feat(home): /test → / 覆盖 + 设备响应`
   - `perf(sphere): JS 层 filter 节流 + 日食跳过 + transition 删除`
   - `feat(effects): C/J/L 三方案 + adaptive quality`
   - `perf(sphere): 删 z 抖动 + ripple 简化 + perspective cap（突破口）`
   - `refactor(archipelago): 抽 render/ 子目录`
2. **mainland 性能基线维持** — adaptiveQuality 默认开 + viewportCull 默认开，未来加新 effect 走 FX 面板 toggle 不直接进 default
3. **glow sprite atlas（性能下一刀）** — 如果未来还嫌 zoom 慢，把 SVG `<filter>` glow 烤成多 size 贴图。彻底脱离 feGaussianBlur 实时卷积。**约 1-2 天工程**，视觉差异接近 0
4. **B 方案兜底（备用）** — zoom > 2.5 关 glow + hysteresis。如果 glow sprite atlas 工程过大，B 方案是廉价替代
5. **26 键盘动画迭代** — `src/components/animations-svg/` 独立线，与 sphere effects 互不干扰
6. **真实 audio 联调** — 主页点圆是否能播放音乐（PlayerProvider）
7. **Dead code 二次清理** — `references/dead-code/` 整棵 + `src/hooks/useKeyVisual.ts` 一次性 `git rm -r`
8. **/test 路由长期保留** — 沙箱使命：未来调 FX 都走 sandbox A/B；已加 noindex 阻止搜索引擎收录
9. **Phase 6 Track 推进** — A2 已完成（`8074d18`），剩 A0/A1/A3/A4/B3/D 等 step；B2 主页 UI 重设计已在 v87 ship 主页（不再等 tester）
