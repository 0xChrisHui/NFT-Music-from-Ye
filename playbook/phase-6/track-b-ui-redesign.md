# Track B — UI 重设计 + 前端体验

> **范围**：NFT cache 用户隔离 + UI 重设计（按页面拆解 + 截图验收） + 草稿铸造按钮 +
> 音频叠加修复 + 前端韧性
>
> **前置**：B2 系列等 tester 反馈；B3 依赖 Track A1（ScoreNFT cron 四连）+ A0（operator 锁）
>
> **对应 findings**：#2 #7 #8 #9 #23 #29
>
> **核心交付物**：产品视觉/交互达到"可以给外人看"水准 + 每个页面都有可验证截图 + 前端层面对常见失败兜底

---

## 冻结决策

### D-B1 — UI 重设计按页面拆解，每页单独验收

B2 不是"整体重设计一次交付"。按页面拆成 B2.0-B2.5，每个页面：
- 反馈优先级输入
- 低保真 / 草图确认方向
- 实施
- 截图验收（桌面 + 移动 + 3 种浏览器）
- 用户确认点

**不允许**："用户审核通过" 这种主观收口。

### D-B2 — 非 UI 重设计的前端 bug 可和 tester 并行

B1 / B3 / B4 / B5 与 UI 重设计方向解耦，可和 tester 反馈轮并行开工。

### D-B3 — B3 草稿铸造按钮有硬前置

B3 接通草稿铸造前必须完成 Track A0（operator 锁）+ A1（ScoreNFT cron 四连）。否则 tester 踩到双 mint / 孤儿 NFT / 覆盖 metadata 等 P0。

### D-B4 — UI 重设计范围界定

B2 只改：`/`（首页）+ `/me` + `/score/[tokenId]` + `/artist`。
不改：`/_not-found`、`/error`、其他页面。

### D-B5 — B2 不改后端 API 契约

UI 重设计期间后端 API 契约不变。若重设计过程发现 API 缺字段，列入 Track A 或额外 issue，不塞进 B2。

---

## 📋 Step 总览

| Step | Findings | 内容 | 工作量 | 依赖 |
|---|---|---|---|---|
| [B1](#step-b1--nft-localstorage-按用户隔离pre-tester-gate) | #2 | NFT cache key 加 user_id 命名空间 | 30 分 | 无（**Pre-tester**）|
| [B2.0](#step-b20--反馈归档--优先级) | — | tester 反馈汇总 + 优先级分类 | 半天 | Tester 反馈窗口结束 |
| [B2.1](#step-b21--首页-重设计) | — | 首页（岛屿 + 播放器 + 登录按钮）视觉 + 交互 | 2-3 天 | B2.0 |
| [B2.2](#step-b22--me-重设计) | — | 个人页卡片视觉 + 空态 + 草稿区（配合 B3）| 1-2 天 | B2.0 + B3（若一起改） |
| [B2.3](#step-b23--scoretokenid-重设计) | — | 分享卡 + 播放器视觉 | 1 天 | B2.0 |
| [B2.4](#step-b24--artist-重设计) | — | 艺术家页信息密度和节奏 | 半天 | B2.0 |
| [B2.5](#step-b25--跨浏览器截图验收) | — | 3 种浏览器 + 桌面/移动断点截图归档 | 半天 | B2.1-B2.4 |
| [B3](#step-b3--接通草稿铸造按钮) | #23 | DraftCard 加铸造按钮 + jam-source mintScore | 半天 | **A0 + A1** |
| [B4](#step-b4--音频叠加修复) | #29 | 快速连点岛屿不叠加 | 2-3 小时 | 无 |
| [B5](#step-b5--前端韧性3-项打包) | #7 #8 #9 | tracks ISR + 移动端首帧 + localStorage 恢复 | 半天 | 无 |

---

## Step B1 — NFT localStorage 按用户隔离【Pre-tester Gate】

### 概念简报
`ripples_minted_token_ids` / `ripples_cached_nfts` 是浏览器全局 key。共享浏览器 / 多账号切换时新用户看到旧用户的红心和 NFT 缓存 → 资产错乱感。

### 📦 范围
- `src/lib/nft-cache.ts`
- `src/components/archipelago/Archipelago.tsx`
- `app/me/page.tsx`
- `src/hooks/useAuth.ts`（logout 挂钩清缓存）

### 做什么
所有 localStorage key 加 user_id 前缀：
```ts
function getCacheKey(userId: string | undefined) {
  return userId ? `ripples_cached_nfts_${userId}` : 'ripples_cached_nfts_anon';
}
```

logout 时清当前 user 的 key：
```ts
export function clearNftCache(userId: string) {
  localStorage.removeItem(`ripples_cached_nfts_${userId}`);
  localStorage.removeItem(`ripples_minted_token_ids_${userId}`);
}
```

### 验证标准
- [ ] 用户 A 登录收藏 → 登出 → B 登录 → /me 不显示 A 的 NFT
- [ ] A 重登 → 仍看得到（不清，只隔离）
- [ ] `scripts/verify.sh` 通过

---

## Step B2.0 — 反馈归档 + 优先级

### 概念简报
Tester 反馈窗口（1-2 周）结束后，不应直接进入 UI 重设计实施，先做反馈归档 + 优先级决策，把"模糊的反馈"变成"可执行的设计需求"。

### 📦 范围
- `reviews/2026-04-XX-phase-6-tester-feedback.md`（新建）
- 和用户讨论优先级

### 做什么

**1. 从反馈渠道（微信/飞书/GitHub）汇总所有反馈**

**2. 按类型分类**

| 类型 | 示例 | 归属 |
|---|---|---|
| 视觉 | "首页岛屿太暗 / 配色不舒服" | B2.1-B2.4 |
| 交互 | "收藏后不知道在哪看 / 登录流程打断" | B2.1-B2.4 |
| 信息架构 | "/me 草稿区找不到入口" | B2.1-B2.2 |
| 文案 | "收藏按钮叫什么不清楚" | B2.0 的文案子任务 |
| 功能缺失 | "想导出 NFT 图 / 想分享给别人" | 非 B2 范围，挂起或列 issue |
| Bug | "某页白屏 / 某按钮没反应" | 列到 B4/B5 或 Track A |

**3. 优先级决策（和用户一起）**

每条反馈标 P0 / P1 / P2 / "明确不做"。
"明确不做" 必须写原因，避免后续反复讨论。

**4. 汇总为设计需求清单**

按页面分：首页有哪些优先级反馈 → 进 B2.1；/me 有哪些 → 进 B2.2；等等。

### 验证标准
- [ ] `reviews/2026-04-XX-phase-6-tester-feedback.md` 包含完整反馈列表 + 分类 + 优先级
- [ ] 用户确认优先级
- [ ] 每条 tester 反馈都有一个归属（B2.X / 其他 track / 明确不做）

---

## Step B2.1 — `/` 首页重设计

### 📦 范围
- `src/components/archipelago/*`
- `src/components/player/BottomPlayer.tsx`
- `src/components/auth/LoginButton.tsx`（视觉层）
- `src/components/FavoriteButton.tsx`（视觉层）

### 做什么
1. 根据 B2.0 归档的首页反馈 + 参考（Patatap 等）
2. 输出低保真（纸笔或 Figma），和用户确认方向
3. 实施视觉 / 交互改动
4. 桌面 + 移动断点（768px）

### 验证标准
- [ ] 低保真通过用户确认
- [ ] 实施后与低保真一致（截图对比）
- [ ] 桌面和移动端分别截图
- [ ] B2.0 归档里 "P0 / P1 首页反馈" 全部闭环
- [ ] `scripts/verify.sh` 通过

---

## Step B2.2 — `/me` 重设计

### 📦 范围
- `app/me/page.tsx`
- `src/components/me/NFTCard.tsx`
- `src/components/me/ScoreCard.tsx`
- `src/components/me/DraftCard.tsx`（如 B3 一起做，按钮集成）
- `src/components/me/EmptyState.tsx`

### 做什么
- 三区（乐谱 / 素材 / 草稿）视觉统一
- 空态文案优化
- 草稿区接 B3 按钮（或 B3 独立完成后本 step 只负责视觉）

### 验证标准
- [ ] 三区有内容 / 部分空 / 全空三种场景截图
- [ ] P0 / P1 /me 反馈全部闭环
- [ ] `scripts/verify.sh` 通过

---

## Step B2.3 — `/score/[tokenId]` 重设计

### 📦 范围
- `app/score/[tokenId]/page.tsx`
- `app/score/[tokenId]/ScorePlayer.tsx`
- `app/score/[tokenId]/opengraph-image.tsx`

### 做什么
- 分享卡视觉（OG image）
- 播放器按钮 + 信息密度
- iframe 加载态优化

### 验证标准
- [ ] OG image 在 Twitter Card Validator / Facebook Debugger 渲染正确
- [ ] 桌面 + 移动截图
- [ ] `scripts/verify.sh` 通过

---

## Step B2.4 — `/artist` 重设计

### 📦 范围
- `app/artist/page.tsx`

### 做什么
- 统计块 + 108 首进度条 + 空投标记点视觉调整
- 响应式（可能简化为只桌面友好）

### 验证标准
- [ ] 桌面截图
- [ ] 移动端是否 in-scope 由用户定，in-scope 就截图，不 in-scope 文档说明

---

## Step B2.5 — 跨浏览器截图验收

### 📦 范围
- `reviews/2026-04-XX-phase-6-ui-screenshots.md`（新建）

### 做什么
对 B2.1-B2.4 四个页面在 3 种浏览器（Chrome / Safari / Firefox）+ 2 种断点（桌面 1440 / 移动 375）拍截图归档。总共 4 页 × 3 浏览器 × 2 断点 = 24 张。

视觉不一致 → 开新 issue 或就地修。

### 验证标准
- [ ] 24 张截图归档到 reviews/
- [ ] 用户审核通过（最终主观但有截图作证）
- [ ] 视觉不一致项全部闭环

---

## Step B3 — 接通草稿铸造按钮

### 概念简报
后端 `/api/mint/score` 和 score_nft_queue 从 Phase 3 就 ready，但前端 UI 没按钮。Phase 3 遗留至今。

### 📦 范围
- `src/components/me/DraftCard.tsx`
- `src/data/jam-source.ts`
- `src/hooks/useMintScore.ts`（新建）

### 依赖（硬性）
- **Track A0**（operator 锁）
- **Track A1**（ScoreNFT cron 四连 + durable lease）

若 A0/A1 未完成就开 B3，tester 立刻踩到双 mint / 孤儿 NFT。

### 做什么

**1. jam-source.ts 加函数**
```ts
export async function mintScore(token: string, pendingScoreId: string): Promise<MintScoreResponse> {
  const res = await fetch('/api/mint/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pendingScoreId }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? '铸造请求失败');
  return res.json();
}
```

**2. useMintScore hook**

状态：idle / loading / queued / error

**3. DraftCard 按钮**
- idle → "铸造成乐谱 NFT" 按钮
- loading → spinner
- queued → "铸造中..."（草稿灰掉，不可点）
- error → 红色 + 重试

### 验证标准
- [ ] Phase 5 S5 B9 冒烟项通过（录制 → 保存 → 铸造 → 上链 → /score/[id] 打开）
- [ ] 端到端耗时 ≤ 5 分钟
- [ ] 并发点同一草稿 → 不会双铸造（后端 UNIQUE + 前端 disable）
- [ ] A0 锁在该场景下确认生效
- [ ] `scripts/verify.sh` 通过

---

## Step B4 — 音频叠加修复（bug #1）

### 概念简报
`PlayerProvider.toggle()` 同步判断 state，但 `play()` 异步。快速连点：两次 toggle 都看到 `playing === false` → 两个 play 并发。

### 📦 范围
- `src/components/player/PlayerProvider.tsx`

### 做什么
加 loadingRef 拦截重复加载 + 加载期间若目标变了则放弃：

```ts
async function play(trackId: string) {
  if (loadingRef.current === trackId) return;
  loadingRef.current = trackId;
  try {
    sourceRef.current?.stop();
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    const buffer = await fetchAndDecode(trackId);
    if (loadingRef.current !== trackId) return; // 期间变了
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
    sourceRef.current = src;
  } finally {
    loadingRef.current = null;
  }
}
```

### 验证标准
- [ ] 快速连点同岛屿 10 次 → 只 1 个音频播放
- [ ] 快速在 3 个岛屿切换 → 始终只 1 个播放
- [ ] `scripts/verify.sh` 通过

---

## Step B5 — 前端韧性（3 项打包）

### 📦 范围
- `app/api/tracks/route.ts` + `src/components/archipelago/Archipelago.tsx`（#7）
- `src/components/jam/HomeJam.tsx`（#8）
- `src/lib/draft-store.ts`（#9）

### 做什么

**#7 tracks 韧性**
```ts
export const revalidate = 300; // ISR 5 分钟
// DB 失败返 empty 数组 + 错误 header 而非 500
```
`Archipelago` 在 tracks 空时显示占位态而非 null。

**#8 移动端首帧**
```tsx
const [isMobile, setIsMobile] = useState<boolean | null>(null);
useEffect(() => { setIsMobile(window.innerWidth < 768); }, []);
if (isMobile === null) return <Loading />;
if (isMobile) return <HomeJamMobileHint />;
return <HomeJamDesktop />;
```

**#9 草稿恢复**
```ts
export function getDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not array');
    return parsed.filter(isValidDraft);
  } catch (err) {
    console.warn('[draft-store] 损坏 localStorage 已清:', err);
    localStorage.removeItem(DRAFTS_KEY);
    return [];
  }
}
```

### 验证标准
- [ ] 手动模拟 Supabase 错 → /api/tracks 返空 + header，Archipelago 占位
- [ ] UA 伪装移动端首帧 → 直接移动提示，不加载 HomeJamDesktop
- [ ] `ripples_drafts` 改成 `"not json"` → /me 正常（drafts 空）
- [ ] `scripts/verify.sh` 通过

---

## Track B 完结标准

- [ ] 10 steps 全绿（B1 + B2.0-B2.5 + B3 + B4 + B5）
- [ ] B9 冒烟项（草稿铸造端到端）通过
- [ ] Tester 反馈窗口所有 "视觉 / 交互" 类条目闭环
- [ ] 24 张跨浏览器截图归档
- [ ] `scripts/verify.sh` 通过
