# Track B — UI 重设计 + 前端体验

> **范围**：NFT cache 用户隔离 + UI 重设计（基于 tester 反馈） + 草稿铸造按钮 +
> 音频叠加修复 + 前端韧性（tracks ISR / 移动端首帧 / localStorage 恢复）
>
> **前置**：B2 等 tester 反馈；B3 依赖 Track A1 完成
>
> **对应 findings**：#2 #7 #8 #9 #23 #29（共 6 项，其中 #7 #8 #9 合并为 B5）
>
> **核心交付物**：产品视觉/交互上 "可以给外人看" 的水准 + 前端层面对常见失败场景的兜底

---

## 冻结决策

### D-B1 — UI 重设计等 tester 反馈

B2 核心工作（视觉、交互、信息架构）不在 Phase 6 启动就开干。等 tester 反馈窗口（1-2 周）结束，把反馈整理成设计输入再动。否则会做无用功。

### D-B2 — 非 UI 重设计的前端 bug 可以和 tester 并行修

B1 / B3 / B4 / B5 都和 UI 重设计方向解耦，可以和 tester 反馈轮并行开工。

### D-B3 — 草稿铸造按钮接通有硬前置

B3 接通草稿铸造按钮前必须完成 Track A1（ScoreNFT cron 四连）。否则 tester 踩到 P0。

### D-B4 — UI 重设计范围界定

B2 不是"重做整个项目"。框定为：首页（岛屿 + 播放器 + 登录）+ /me（卡片视觉 + 空态）+ /score/[id]（分享卡 + 回放）+ /artist（信息密度）。其他页面（404 / error / artist 已够简）不动。

---

## 📋 Step 总览

| Step | Findings | 内容 | 工作量 | 依赖 |
|---|---|---|---|---|
| [B1](#step-b1--nft-localstorage-按用户隔离pre-tester-gate) | #2 | NFT cache key 加 user_id 命名空间 | 30 分 | 无（**Pre-tester**）|
| [B2](#step-b2--ui-重设计基于-tester-反馈) | — | 首页 + /me + /score + /artist 视觉/交互/信息架构 | 1-2 周 | Tester 反馈 |
| [B3](#step-b3--接通草稿铸造按钮) | #23（= bug #5）| DraftCard 加铸造按钮 + jam-source mintScore 函数 | 半天 | **Track A1** |
| [B4](#step-b4--音频叠加修复) | #29（= bug #1）| 快速连点岛屿不再叠加音频 | 2-3 小时 | 无 |
| [B5](#step-b5--前端韧性3-项打包) | #7 #8 #9 | tracks ISR/fallback + 移动端首帧 + localStorage 损坏恢复 | 半天 | 无 |

---

## Step B1 — NFT localStorage 按用户隔离【Pre-tester Gate】

### 概念简报
`ripples_minted_token_ids` 和 `ripples_cached_nfts` 是浏览器全局 key。共享浏览器 / 多账号切换 / 登出重登时，新用户看到上一个人的红心和 /me NFT 缓存。对 NFT 产品来说 = 资产错乱。

### 📦 范围
- `src/lib/nft-cache.ts`
- `src/components/archipelago/Archipelago.tsx`
- `app/me/page.tsx`

### 做什么
所有 localStorage key 加 user_id 前缀：
```ts
function getCacheKey(userId: string | undefined): string {
  if (!userId) return 'ripples_cached_nfts_anon';
  return `ripples_cached_nfts_${userId}`;
}
```

登出时清空所有以 `ripples_` 开头的 key（可选，或只清当前 user 的）：
```ts
export function clearNftCache(userId: string) {
  localStorage.removeItem(getCacheKey(userId));
  localStorage.removeItem(getMintedKey(userId));
}
```

`useAuth` 的 logout 里挂一个 hook 调 `clearNftCache`。

### 验证标准
- [ ] 用户 A 登录 → 收藏一张 → 登出 → 用户 B 登录 → /me 不显示 A 的 NFT
- [ ] 用户 A 重新登录 → /me 仍能看到之前的缓存（按 user 隔离但不清）
- [ ] `scripts/verify.sh` 通过

---

## Step B2 — UI 重设计（基于 tester 反馈）

### 概念简报
Phase 5 UI 是"能跑起来的最小版"，视觉粗、交互细节未打磨。tester 反馈 1-2 周后把反馈整理成设计输入，开始重设计。

### 📦 范围
**明确 in scope**：
- `/`（首页）— 岛屿视觉 + 爱心反馈 + 播放条 + 登录按钮
- `/me`（个人页）— 卡片视觉、空态、草稿区（B3 接通按钮后一起）
- `/score/[tokenId]`（公开回放）— 分享卡 + 播放器视觉
- `/artist`（艺术家页）— 信息密度和节奏

**明确 out of scope**：
- 404 / error 页（已足够简）
- 全新页面（不加）

### 做什么（框架性，细节等反馈）

**1. 反馈归档**
- 从 tester 渠道（微信/飞书/GitHub Issues）汇总反馈
- 归档到 `reviews/2026-04-XX-phase-6-tester-feedback.md`
- 按 "视觉 / 交互 / 信息架构 / 文案 / 其他" 分类

**2. 设计输入准备**
- 参考素材：Patatap、Bandcamp、ENS profile
- 输出：简单低保真（或直接 Figma / 纸笔）
- 和用户确认方向

**3. 实施**
- 每个页面单独改，`verify.sh` 绿 + 用户看过再合并
- 保持现有信息架构优先，视觉换皮为主
- 重设计期间**不改**后端 API 契约

### 验证标准
- [ ] 用户审核通过（主观判断）
- [ ] tester 反馈清单所有 "视觉 / 交互" 类条目状态闭环（修 / 明确不做）
- [ ] `scripts/verify.sh` 通过
- [ ] 在 3 种主流浏览器（Chrome / Safari / Firefox）视觉一致

---

## Step B3 — 接通草稿铸造按钮

### 概念简报
后端 `POST /api/mint/score` 和 score_nft_queue 从 Phase 3 就 ready，但 `DraftCard.tsx` 没有铸造按钮，`jam-source.ts` 没有 mintScore 函数。这是 bug #5 从 Phase 3 遗留至今。

### 📦 范围
- `src/components/me/DraftCard.tsx`（加按钮 + loading/error 状态）
- `src/data/jam-source.ts`（加 `mintScore` 函数）
- `src/hooks/useMintScore.ts`（新建，封装 loading + 错误处理）

### 依赖
**Track A1 必须先完成**。否则 tester 一点按钮立刻暴露 ScoreNFT cron 的 4 个 P0（双 mint / 孤儿 NFT / 覆盖 metadata / 超时）。

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
- 状态：idle / loading / queued / error
- queued 状态下 DraftCard 显示"排队中"+ /me 下一次刷新会看到队列里的 ScoreNFT 进度

**3. DraftCard 按钮**
- idle → 显示 "铸造成乐谱 NFT" 按钮
- loading → spinner
- queued → "铸造中..."（草稿变灰、不可再次点击）
- error → 红色提示 + 重试

### 验证标准
- [ ] Phase 5 S5 B9 清单通过（录制 → 保存 → 铸造 → 上链 → /score/[id] 能打开）
- [ ] 端到端耗时：点击按钮到 /score/[id] 可访问 ≤ 5 分钟
- [ ] 并发点击同草稿 → 不会双重铸造（后端 UNIQUE(pending_score_id) + 前端按钮 disable）
- [ ] `scripts/verify.sh` 通过

---

## Step B4 — 音频叠加修复（bug #1）

### 概念简报
`PlayerProvider.toggle()` 判断 playing state 是同步的，但 `play()` 的 fetch/decode 异步。快速连点：两次 toggle 都看到 `playing === false` → 两个 `play()` 并发 → 两个 source 都启动，无法 stop 第二个。

### 📦 范围
- `src/components/player/PlayerProvider.tsx`
- `src/components/archipelago/Island.tsx`

### 做什么
加一个 `loadingRef` + 请求合并：
```ts
const loadingRef = useRef<string | null>(null);

async function play(trackId: string) {
  if (loadingRef.current === trackId) return; // 同曲正在加载，忽略
  loadingRef.current = trackId;
  try {
    // 先 stop 当前
    sourceRef.current?.stop();
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    // 加载新的
    const buffer = await fetchAndDecode(trackId);
    // 加载期间 state 变了（比如用户又点别的曲）→ 放弃
    if (loadingRef.current !== trackId) return;
    // 实际 start
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(...);
    src.start();
    sourceRef.current = src;
  } finally {
    loadingRef.current = null;
  }
}
```

Island.tsx 的按钮 onClick 不做任何异步等待，只调 `toggle()`。

### 验证标准
- [ ] 快速连点同一岛屿 10 次 → 只有 1 个音频实际播放
- [ ] 快速在 3 个岛屿间切换 → 始终只有 1 个音频播放
- [ ] `scripts/verify.sh` 通过

---

## Step B5 — 前端韧性（3 项打包）

### 概念简报
三个独立小 bug 合并修复：
- **#7** `GET /api/tracks` 无 ISR/cache，DB 抖首页群岛消失
- **#8** 移动端 fallback 首帧加载桌面音效引擎
- **#9** 草稿 localStorage 损坏无 try-catch，/me 直接白屏

### 📦 范围
- `app/api/tracks/route.ts` + `src/components/archipelago/Archipelago.tsx`（#7）
- `src/components/jam/HomeJam.tsx`（#8）
- `src/lib/draft-store.ts`（#9）

### 做什么

**#7 tracks 韧性**
```ts
// app/api/tracks/route.ts
export const revalidate = 300; // ISR 5 分钟
// 同时加 try-catch：DB 失败返 stale / empty + 错误头而不是 500
```

`Archipelago` 在 tracks.length === 0 时显示占位态（"加载中 / 重试按钮"）而不是 `null`。

**#8 移动端首帧**
```tsx
// HomeJam.tsx
const [isMobile, setIsMobile] = useState<boolean | null>(null);
useEffect(() => { setIsMobile(window.innerWidth < 768); }, []);
if (isMobile === null) return <Loading />; // 避免首帧错 UI
if (isMobile) return <HomeJamMobileHint />;
return <HomeJamDesktop />;
```

**#9 草稿恢复**
```ts
// draft-store.ts
export function getDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('drafts not array');
    return parsed.filter(isValidDraft); // schema 校验
  } catch (err) {
    console.warn('[draft-store] 损坏的 localStorage 已清空:', err);
    localStorage.removeItem(DRAFTS_KEY);
    return [];
  }
}
```

### 验证标准
- [ ] 手动 throw 一个 Supabase 错误 → /api/tracks 返缓存/错误态，Archipelago 显示占位
- [ ] 用户 UA 伪装移动端首次访问 → 首帧直接是移动端提示，不加载 HomeJamDesktop 音效
- [ ] 手动把 localStorage 里 `ripples_drafts` 改成 `"not json"` → /me 正常显示（drafts 空）
- [ ] `scripts/verify.sh` 通过

---

## Track B 完结标准

- [ ] 5 steps 全绿（B2 完成度由产品侧判断）
- [ ] Phase 5 S5 B9 冒烟项通过（草稿铸造端到端）
- [ ] Tester 反馈窗口里的"视觉 / 交互"类条目状态闭环
- [ ] 3 种浏览器 UI 一致
- [ ] `scripts/verify.sh` 通过
