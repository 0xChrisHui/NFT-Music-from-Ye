# Phase 5 S5 冒烟测试 Review

日期：2026-04-24
会话：在 022 会话（Semi 字段对齐）之后，023 会话做的 S5 冒烟测试
域名：https://pond-ripple.xyz（Vercel Hobby + cron-job.org 免费触发）

---

## 测试结果：10/12 通过

| 批次 | # | 项 | 结果 | 备注 |
|---|---|---|---|---|
| A 基础可达 | A1 | 首页能打开 + 音效 | ✅ | 带 bug #1 |
| | A2 | /api/ping | ✅ | |
| | A3 | 404 页面 | ✅ | |
| | A4 | /api/health | ✅ | wallet low 告警触发 bug #3 |
| B 核心业务 | B5 | Privy 邮箱登录 | ✅ | bug #4 记录 |
| | B6 | 登出重登 | ✅ | |
| | B7 | ❤️ 收藏入队 | ✅ | /me 显示 pending |
| | B8 | cron 上链 | ✅ | Etherscan 可查 |
| | B9 | 乐谱录制 → 铸造 | ⏭ 延后 | bug #5 UI 按钮未实现 |
| | B10 | /artist | ✅ | |
| C 安全 | C11 | cron 未授权 → 401 | ✅ | |
| | C12 | mint 限流 → 429 | ❌ | bug #6 rate limit 失效 |

---

## Bug 清单（6 个）

### 测试前必修（2026-04-25 修订后：只剩 1 个）

#### Bug #3 — operator 钱包余额过低
- **严重度**：高（阻塞 tester）
- **现状**：OP Sepolia 钱包 0.009481 ETH，低于 0.05 阈值
- **影响**：每次用户点 ❤️ 都消耗 operator gas，10-20 人测试会快速耗尽
- **修复**：走 OP Sepolia faucet 领 0.1+ ETH 到 operator 地址
- **操作者**：用户（需要 faucet 页面验证人机）

#### Bug #6 — Rate limit 线上失效 ❌ **误判（2026-04-25 修订）**
- **原判断**：25 次连续 POST /api/mint/material 全部 401，无任何 429 → 推测 Upstash fail-open
- **实际情况**：Rate limit 一直正常工作。真正原因是我 C12 测试方法有缺陷
- **2026-04-25 验证**：
  - Vercel Runtime Log 显示 middleware 确实调用 Upstash 并拿到 200 响应（`POST intent-pig-71885.upstash.io/pipeline → 200 235ms`）
  - 从用户机器发 30 个**并发**请求：`10 × 401 + 20 × 429`，完全符合 sliding window 20/10s 的设计
- **原测试为什么漏**：
  - Vercel middleware 跑在 sin1（新加坡）
  - Upstash 在 us-east（创建时选的 US East 1）
  - 每次 middleware → Upstash 往返 ~235ms 跨洋延迟
  - 顺序 curl 变成每 1.6 秒发一次，30 个请求均摊到 49 秒
  - 每 10 秒窗口只有 6 个请求 → 永远到不了 20 阈值
- **附带发现（不阻塞）**：跨区延迟给每个限流 API 增加 ~250ms 开销。未来可以迁 Upstash 到 ap-southeast-1 优化。
- **commit `1bb1b05` 加的 middleware 日志**：虽然 bug 是误判，但这些 `console.warn` / `console.error` 观测日志是有用的预防性改进，以后 Upstash 真挂了能直接看日志定位。

#### Bug #2 — 点击右上角钱包地址 → 直接登出
- **严重度**：中（破坏用户体验，tester 很容易误触）
- **现状**：登录后右上角显示钱包地址，点击直接触发 logout
- **应该**：点击打开下拉菜单（复制地址 / 查看个人页 / 登出），或直接跳 /me
- **位置**：`src/components/auth/LoginButton.tsx` 或 Providers.tsx 附近
- **修复复杂度**：小（10-30 分钟）

### Phase 6 UI 重设计时一起做（2 个）

#### Bug #1 — 岛屿快速连点 → 音频叠加无法关闭
- **严重度**：中
- **现状**：快速连续点击岛屿，有概率触发多个音频同时播放且无法停止
- **用户记忆**：以前修过一次，是回归
- **定位线索**：`src/hooks/useAudioPlayer.ts` 或 Archipelago 组件的点击 handler，查 git blame 看历史修复
- **Phase 6 触发**：UI 重设计会重写交互层，正好一起处理

#### Bug #5 — 草稿铸造按钮 UI 未实现
- **严重度**：中（Phase 3 遗留 gap）
- **现状**：`src/components/me/DraftCard.tsx` 只有标题 + 倒计时，没有铸造按钮；`src/data/jam-source.ts` 没有任何函数调用 `/api/mint/score`
- **后端状态**：`POST /api/mint/score` + score_queue + 5 步 cron 状态机 **全部就绪**（Phase 3 S5 已用 tokenId 2 "晨雾" 端到端实测）
- **需要做**：
  1. `src/data/jam-source.ts` 加 `mintScore(token, scoreId)` 函数
  2. `src/components/me/DraftCard.tsx` 加铸造按钮（loading 状态 + 成功后刷新）
  3. 或者新建 `src/hooks/useMintScore.ts` 封装
- **Phase 6 触发**：UI 重设计必然覆盖 /me 页，顺带实现

### 忽略（1 个）

#### Bug #4 — A 邮箱收不到 Privy 验证码
- **严重度**：低
- **现状**：用户的某个邮箱（A 邮箱）收不到验证码，B/C 邮箱正常
- **决定**：忽略 — 邮箱服务商差异（可能进垃圾邮件或邮箱商反垃圾过于严格），不是代码问题

---

## 已确认线上工作正常的能力

- ✅ 首页可访问（HTTPS）
- ✅ Privy 邮箱登录（至少 2 个邮箱验证过）
- ✅ 素材 NFT 端到端：POST /api/mint/material → queue → cron → 链上 → /me 显示
- ✅ cron-job.org 5 个 job 运行中（process-mint-queue / process-score-queue / process-airdrop 每分钟 / sync-chain-events 每 5 分钟 / check-balance 每小时）
- ✅ 鉴权：cron 端点 Authorization: Bearer 生效，无凭证 401
- ✅ /api/health 返回完整 JSON（db / wallet / queues 状态）
- ✅ /api/ping 200 OK
- ✅ 404 错误页
- ✅ /artist 统计页
- ✅ /me 登出重登 → 同一地址（身份持久化）

---

## 下一步

1. **修 3 个测试前必修 bug**（#2 / #3 / #6），工作量：
   - #3 用户操作 faucet — 15 分钟
   - #6 检查 Vercel Upstash 环境变量 + Redeploy — 30 分钟
   - #2 代码改 `LoginButton.tsx` + 部署 — 30-60 分钟

2. **上 10-20 人 tester**（Phase 5 尾声 / Phase 5.5 反馈轮）
   - 收集真实用户反馈 1-2 周
   - bug 和体验反馈作为 Phase 6 UI 重设计的输入

3. **Phase 6 UI 重设计**
   - 基于 tester 反馈 + 审美规划
   - 顺带修 bug #1（音频叠加）+ bug #5（草稿铸造按钮）

4. **Phase 7 OP 主网**
