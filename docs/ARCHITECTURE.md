# 108 Cyber Records — 技术架构文档

> 一位艺术家用两年时间，将 108 首音乐逐周刻进区块链。每位用户可与艺术家合奏，并将生成的音乐永久存储进自己的钱包。

---

## 一、产品概述

### 核心体验

```
首次访问 → 引导动画（"点击它"→音乐响起→"试试键盘"→音效+视觉爆炸）
  → 浏览群岛（悬停预览、颜色暗示风格、铸造人数标记）
  → 点击岛屿播放 → 底部播放条控制（进度/音量/静音）
  → 合奏（键盘/触控 + Patatap 视觉反馈）
  → 合奏结束 → 自动预览回放 → 重录 / 铸造 / 保存（24h）
  → 铸造 → 即时成功🎉 → 分享卡片（封面图 + 一键复制链接）
  → 个人页唱片架回放、24h 沉入水面倒计时、空投开箱

用户全程不需要 ETH / AR / 签名。只需登录获得地址。
```

### 三大模块

| 模块 | 说明 |
|------|------|
| **聆听** | 108 首音乐 × 群岛结构，一键铸造 |
| **共创** | 键盘/触控合奏 + 录制 → 乐谱 NFT（自带链上钱包） |
| **重组** | 每 36 首 AI 再创作，空投参与者 |

---

## 二、技术栈

### Launch（Phase 1-3）

| 层级 | 技术 |
|------|------|
| 区块链 | Ethereum Mainnet |
| 合约 | ERC-1155（素材）+ ERC-721 + ERC-6551（乐谱） |
| 存储 | Arweave（Turbo SDK，信用卡支付） |
| 前端 | Next.js 14 + TypeScript + Tailwind，Vercel Hobby/Pro |
| 音频 | Web Audio API + Patatap（或自建简化版） |
| 登录 | Privy SDK（邮箱 + 外部钱包） |
| 铸造 | 乐观 UI + Vercel Cron 每分钟处理队列 |
| 数据库 | Supabase Free |
| 合约交互 | viem（仅后端） |

### Future（Phase 4-5 按需引入）

| 技术 | 引入时机 |
|------|----------|
| 社区钱包 API 登录 | Phase 4 |
| 独立 Worker（Railway/Fly.io） | 用户量增长，Cron 1 分钟间隔不够时 |
| Supabase Pro（Point-in-Time Recovery） | 有付费用户或数据量大时 |
| Sentry | 生产环境稳定性需要时 |
| Base 链部署 | 主网 Gas 成本不可承受时 |

### 不使用

wagmi / ethers.js / ERC-4337 / Paymaster / Pimlico / Privy Smart Account / Hardhat

---

## 三、目录结构

```
108-cyber-records/
├── ARCHITECTURE.md
├── HARDENING.md                   # 安全加固 & 演进路线
├── QUICKSTART.md                  # 快速上手
├── CLAUDE.md                      # AI 编码规则
├── .env.example
│
├── contracts/                     # Foundry
│   ├── src/
│   │   ├── MaterialNFT.sol            # ERC-1155（含 allowlist + 每日上限）
│   │   ├── ScoreNFT.sol               # ERC-721
│   │   └── MintOrchestrator.sol       # 编排合约
│   ├── test/
│   └── script/
│
├── scripts/
│   ├── upload-track.ts                # 每周上架
│   ├── upload-arweave.ts
│   ├── airdrop.ts
│   └── generate-covers.ts            # Phase 3：封面图生成+上传
│
├── covers/                        # Phase 3：封面图工作区
│   ├── layers/                        # 艺术家图层素材
│   ├── output/
│   └── hashlips-config.js
│
├── supabase/
│   └── migrations/                    # 版本化 schema 管理
│       ├── 001_initial_schema.sql         # Phase 1：tracks, users, mint_queue, mint_events
│       ├── 002_jam_and_scores.sql         # Phase 2：pending_scores, sounds
│       ├── 003_covers_and_airdrops.sql    # Phase 3：score_covers, airdrop_events
│       └── 004_community_auth.sql         # Phase 4：扩展 users 表
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # AuthProvider + BottomPlaybar
│   │   ├── page.tsx                       # 群岛 + 播放 + 合奏
│   │   ├── profile/page.tsx               # 唱片架 + 待铸造 + 空投
│   │   ├── artist/page.tsx                # 动态（进度/统计/倒计时）
│   │   ├── score/[tokenId]/page.tsx       # 公开回放页（OG tags）
│   │   └── api/
│   │       ├── tracks/route.ts                # GET（ISR 缓存）
│   │       ├── score/
│   │       │   ├── save/route.ts              # POST：暂存乐谱
│   │       │   └── [tokenId]/route.ts         # GET：公开乐谱数据
│   │       ├── mint/
│   │       │   ├── material/route.ts          # POST：写队列，立即返回
│   │       │   └── score/route.ts             # POST：写队列，立即返回
│   │       ├── auth/community/route.ts        # Phase 4
│   │       ├── user/nfts/route.ts             # GET：NFT + 乐谱回放
│   │       ├── artist/stats/route.ts          # GET：艺术家统计
│   │       ├── health/route.ts                # GET：健康检查
│   │       └── cron/
│   │           ├── process-mint-queue/route.ts    # 每分钟：串行铸造
│   │           ├── sync-chain-events/route.ts     # 每 5 分钟
│   │           └── check-balance/route.ts         # 每小时
│   │
│   ├── components/
│   │   ├── providers/AuthProvider.tsx
│   │   ├── onboarding/FirstVisitGuide.tsx
│   │   ├── archipelago/
│   │   │   ├── Archipelago.tsx                # 悬停预览 + 铸造标记 + 风格暗示
│   │   │   ├── Island.tsx
│   │   │   └── Ripple.tsx
│   │   ├── player/
│   │   │   ├── AudioPlayer.tsx
│   │   │   ├── BottomPlaybar.tsx              # 全局底部（进度/音量/静音）
│   │   │   ├── ScorePlayer.tsx                # 乐谱回放
│   │   │   └── ScorePreview.tsx               # 合奏结束即时预览
│   │   ├── jam/
│   │   │   ├── KeyboardInstrument.tsx          # Patatap 键盘/触控 + 视觉
│   │   │   ├── SoundBank.tsx
│   │   │   └── ScoreRecorder.tsx
│   │   ├── mint/
│   │   │   ├── MintMaterialButton.tsx         # 乐观 UI
│   │   │   ├── MintScoreButton.tsx            # 乐观 UI + ShareCard
│   │   │   └── ShareCard.tsx                  # 封面图 + 一键复制链接
│   │   ├── auth/
│   │   │   ├── LoginModal.tsx
│   │   │   └── CommunityLogin.tsx             # Phase 4
│   │   └── profile/
│   │       ├── RecordShelf.tsx                # 唱片架（非 NFT 网格）
│   │       ├── PendingScores.tsx              # 沉入水面倒计时
│   │       ├── AirdropUnbox.tsx               # 开箱体验
│   │       └── ExpiredAnimation.tsx           # 沉入海底动画
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useAudioPlayer.ts
│   │   ├── useKeyboardJam.ts
│   │   ├── useUserNFTs.ts
│   │   └── useFirstVisit.ts
│   │
│   ├── lib/
│   │   ├── contracts.ts
│   │   ├── arweave.ts                         # 含多网关 fallback
│   │   ├── supabase.ts
│   │   ├── privy.ts
│   │   ├── community-auth.ts                  # Phase 4
│   │   ├── operator-wallet.ts                 # viem，仅后端
│   │   └── alerts.ts                          # Telegram 告警
│   │
│   └── types/
│       ├── track.ts
│       ├── score.ts
│       ├── nft.ts
│       └── auth.ts
│
└── public/
    ├── sounds/                                # 26 音效（mp3, <100KB）
    └── tracks/                                # 音乐缓存
```

---

## 四、数据库（按 Phase 递增）

### Phase 1：4 张表

```sql
-- 001_initial_schema.sql

CREATE TABLE tracks (
  id SERIAL PRIMARY KEY,
  token_id INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '艺术家名',
  audio_url TEXT NOT NULL,
  arweave_audio_tx TEXT,
  arweave_metadata_tx TEXT,
  track_type TEXT NOT NULL DEFAULT 'original',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_type TEXT NOT NULL DEFAULT 'privy',
  privy_user_id TEXT UNIQUE,
  community_user_id TEXT UNIQUE,               -- Phase 4 使用
  evm_address TEXT NOT NULL,
  handle TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_users_evm ON users(evm_address);

CREATE TABLE mint_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  mint_type TEXT NOT NULL,                     -- 'material' | 'score'
  token_id INTEGER,                            -- material 时
  score_id UUID,                               -- score 时（Phase 2 加外键）
  status TEXT NOT NULL DEFAULT 'pending',       -- pending → minting_onchain → confirming → success | failed
  error_message TEXT,
  arweave_metadata_tx TEXT,
  tx_hash TEXT,
  gas_used BIGINT,
  cover_id INTEGER,                            -- Phase 3 使用
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3
);
CREATE INDEX idx_queue_status ON mint_queue(status);

CREATE TABLE mint_events (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  token_id INTEGER NOT NULL,
  token_type TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  score_data JSONB,                            -- Phase 2：铸造时复制完整 events
  cover_arweave_tx TEXT,                       -- Phase 3：封面图
  operator_gas_used BIGINT,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mint_user ON mint_events(user_id);
```

### Phase 2 追加

```sql
-- 002_jam_and_scores.sql

CREATE TABLE sounds (
  id SERIAL PRIMARY KEY,
  key CHAR(1) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  arweave_audio_tx TEXT,
  token_id INTEGER UNIQUE
);

CREATE TABLE pending_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  base_track_token_id INTEGER NOT NULL,
  events JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending → minting → minted | expired
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX idx_pending_user ON pending_scores(user_id);
CREATE INDEX idx_pending_status ON pending_scores(status);

-- mint_queue 加外键
ALTER TABLE mint_queue ADD CONSTRAINT fk_queue_score FOREIGN KEY (score_id) REFERENCES pending_scores(id);

-- mint_queue 状态机扩展（score 需要先上传 Arweave）
-- pending → uploading_arweave → minting_onchain → confirming → success | failed

-- 定时任务
SELECT cron.schedule('expire-scores', '0 * * * *',
  $$UPDATE pending_scores SET status='expired' WHERE status='pending' AND expires_at < NOW()$$);
SELECT cron.schedule('purge-expired', '0 3 * * *',
  $$DELETE FROM pending_scores WHERE status='expired' AND expires_at < NOW() - INTERVAL '7 days'$$);
SELECT cron.schedule('timeout-mints', '30 * * * *',
  $$UPDATE mint_queue SET status='failed', error_message='timeout' WHERE status IN ('pending','uploading_arweave','minting_onchain') AND created_at < NOW() - INTERVAL '24 hours'$$);
```

### Phase 3 追加

```sql
-- 003_covers_and_airdrops.sql

CREATE TABLE score_covers (
  id SERIAL PRIMARY KEY,
  arweave_tx TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,      -- 允许复用
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE airdrop_events (
  id SERIAL PRIMARY KEY,
  round INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  token_id INTEGER NOT NULL,
  tx_hash TEXT,
  airdropped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mint_queue ADD CONSTRAINT fk_queue_cover FOREIGN KEY (cover_id) REFERENCES score_covers(id);

-- 链上事件同步
CREATE TABLE chain_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  log_index INTEGER NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tx_hash, log_index)
);
CREATE INDEX idx_chain_to ON chain_events(to_address);

CREATE TABLE system_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO system_kv VALUES ('last_synced_block', '0', NOW());
```

### RLS 说明

```
API Routes 使用 SUPABASE_SERVICE_ROLE_KEY + 手动 WHERE user_id 过滤。
不依赖 current_setting()，避免 connection pool 问题。
RLS 保留作为防御层。
```

---

## 五、智能合约

### 铸造模式

```
用户点铸造 → API Route 写 mint_queue → 立即返回 → 前端显示成功
Vercel Cron 每分钟取一条 pending 任务 → 运营钱包发交易 → 等确认 → 写 mint_events
失败自动重试（max 3 次）→ 彻底失败时 Telegram 告警

Phase 1 状态机（material）：  pending → minting_onchain → confirming → success | failed
Phase 2 状态机（score）：    pending → uploading_arweave → minting_onchain → confirming → success | failed
```

### MaterialNFT（ERC-1155）

```
tokenId：1-108 音乐，109-134 音效

权限：allowlist（非 onlyOwner）
  mapping(address => bool) public minters;
  只有 allowlist 地址可 mint → 热钱包泄露只能 mint 无价值 NFT

链上保护：
  全局每日 mint 上限（如 200 个/天）→ 防突然爆火烧光 Gas
  达到上限时交易 revert → 前端提示"今日铸造已满，明天再来"

函数：
  mint(address to, uint256 tokenId, uint256 amount) onlyMinter
  mintBatch(address to, uint256[] tokenIds, uint256[] amounts) onlyMinter
```

### ScoreNFT（ERC-721）

```
tokenId 自增。mint 仅 MintOrchestrator 可调用。

Metadata（OpenSea 兼容）：
  {
    "name": "Cyber Score #001",
    "description": "与艺术家共同完成的合奏唱片",
    "image": "ar://...封面图.jpg",                  ← OpenSea 渲染
    "animation_url": "ar://...主音乐.mp3",          ← OpenSea 播放
    "external_url": "https://108cyber.xyz/score/1",  ← 公开回放页
    "base_track": { "token_id": 12, "arweave_audio": "ar://..." },
    "events": [{ "key": "A", "sound": "kick", "sound_token_id": 109, "arweave_audio": "ar://...", "timestamp_ms": 1200 }],
    "attributes": [
      { "trait_type": "base_track", "value": "Track #012" },
      { "trait_type": "instruments_used", "value": 5 },
      { "trait_type": "duration_seconds", "value": 180 }
    ]
  }
```

### MintOrchestrator

```
mintScore(address user, string tokenURI, uint256 baseTrackTokenId, uint256[] soundTokenIds)
  1. ScoreNFT.mint(user, tokenURI) → scoreTokenId
  2. ERC-6551 Registry.createAccount → TBA
  3. MaterialNFT.mint(TBA, baseTrackTokenId, 1)
  4. MaterialNFT.mintBatch(TBA, soundTokenIds, [...])

★ ERC-6551 fallback：
  如果 ERC-6551 不可用（标准变更/实现有 bug），
  乐谱 NFT 退化为普通 ERC-721（只含 Metadata，不创建 TBA）。
  核心体验（合奏/录制/回放/永久存储）完全不受影响。
  代码中 TBA 逻辑隔离到可开关的模块中。

★ 合约升级 = allowlist 切换：
  部署新 Orchestrator → allowlist 加新地址 → 移除旧地址。
  不需要代理模式。
```

---

## 六、API 设计

### 公开

| 端点 | 说明 |
|------|------|
| `GET /api/tracks` | 素材列表（ISR 缓存 1h，数据库故障时返回缓存） |
| `GET /api/score/:tokenId` | 公开乐谱数据（ScorePlayer 回放用） |
| `GET /api/artist/stats` | 发布进度 / 总铸造数 / 倒计时 |
| `GET /api/health` | Supabase + RPC + 余额检查 |

### 需鉴权（Bearer JWT）

| 端点 | 说明 |
|------|------|
| `POST /api/mint/material` | 写 mint_queue，立即返回 `{ mintId }` |
| `POST /api/mint/score` | 写 mint_queue，立即返回 `{ mintId, coverUrl }` |
| `POST /api/score/save` | 暂存乐谱（24h TTL） |
| `GET /api/user/nfts` | 已铸造 NFT（含 score_data 回放）+ 待铸造 + 进行中 |
| `POST /api/auth/community` | Phase 4：社区钱包登录代理（5s 超时降级） |

### Mint API 细节

```typescript
// POST /api/mint/material
// 请求：{ tokenId: 12, idempotencyKey: "uuid" }
// 逻辑：验证 JWT → idempotency 去重 → 写 mint_queue → 返回
// 响应：{ result: "ok", mintId: "uuid" }
// 前端收到即显示成功（乐观 UI）

// POST /api/mint/score
// 请求：{ scoreId: "uuid", idempotencyKey: "uuid" }
// 逻辑：JWT → 去重 → pending_scores.status='minting' → 分配封面 → 写 mint_queue
// 响应：{ result: "ok", mintId: "uuid", coverUrl: "ar://..." }
// 前端显示成功 + 弹出 ShareCard
```

### Cron（Vercel Cron，带 CRON_SECRET）

| 端点 | 频率 | 逻辑 |
|------|------|------|
| `process-mint-queue` | 每 1 分钟 | 取一条 pending → 发交易 → 等确认 → 写 mint_events |
| `sync-chain-events` | 每 5 分钟 | Alchemy getLogs → chain_events（从 last_synced_block 开始） |
| `check-balance` | 每小时 | 热钱包 < 0.1 ETH 或队列 > 50 → Telegram 告警 |

---

## 七、认证

### Launch：Privy JWT 直接使用

```
Privy 登录的用户 → 直接使用 Privy JWT（Privy 服务端 SDK 验证）
后端：privy.verifyAuthToken(token) → 获取 userId + wallet.address
不需要自己签发 JWT，减少一半认证复杂度。
```

### Future（Phase 4）：社区钱包加自签 JWT

```
社区钱包用户 → 代理登录社区 API → 获取 evm_address → 签发本站 JWT
后端验证时：先尝试 Privy 验证 → 失败再尝试自签 JWT 验证

社区 API 5 秒超时，失败降级"请使用其他方式登录"。
首次登录后 evm_address 存 users 表，后续只需 JWT 不再依赖社区 API。
```

---

## 八、前端体验

### 首次引导（声音+动画，不是文字教程）

```
useFirstVisit（localStorage）→ 岛屿脉冲+"点击它" → 音乐响 → "试试键盘" → 音效+视觉 → 引导结束
```

### 群岛

```
渐进式：1首→孤岛, 2-5→散落, 6-36→岛群, 37-72→双岛群, 73-108→完整群岛
颜色=情绪, 大小=铸造热度, 标记=已铸造, 悬停=2-3秒预览+铸造人数
Canvas 或 SVG，力导向图布局
```

### 合奏

```
Patatap 键盘/触控 + 视觉反馈（原版内置移动端支持）
★ 如果 Patatap 无法集成 Next.js，自建简化版：
  Web Audio API + Canvas 2D，6-8 种基础动画随机分配 26 键
  Phase 1 开始前做 spike（一天内在空项目中验证）

合奏结束 → ScorePreview 自动回放 → 三选一：重录 / 铸造 / 保存
```

### 铸造（乐观 UI）

```
点击 → 前端立即"成功🎉" → ShareCard 弹出（封面图 + 一键复制 /score/:tokenId）
唱片架中新唱片有呼吸动画（"确认中"）→ 后台确认后停止动画
只有彻底失败才通知（极低概率）
```

### 24h TTL 可视化

```
待铸造列表：岛屿沉入水面动画 + 倒计时
最后 1 小时：邮件提醒（有邮箱时）
过期：沉入海底动画（不是静默删除）
```

### 全局底部播放条

```
BottomPlaybar：固定底部，跨页不中断
  曲目名 | ▶/⏸ | 进度条 | 🔊音量 | 🔇静音
```

### 个人页：唱片架

```
RecordShelf：横向滚动封面 → 点击翻转（乐谱详情）→ 播放回放
链上确认中的唱片有呼吸动画
每张唱片有"分享"入口
```

### 公开回放页 `/score/[tokenId]`

```
任何人可访问 → 封面图 + ScorePlayer 回放 + 铸造者信息
OG Meta Tags：og:title / og:image / og:description
→ 微信/Twitter 分享自动显示封面图
数据来源：mint_events.score_data（灾备：链上 tokenURI → Arweave）
```

### 艺术家页（动态）

```
GET /api/artist/stats → 进度条（N/108）+ 总铸造数 + 独立用户数 + 下一首倒计时
```

### 空投开箱

```
AirdropUnbox：群岛出现特殊岛屿 → 点击揭晓 → AI 再创作展示
```

---

## 九、封面图

```
HashLips Art Engine：艺术家画 5-8 层 × 10-20 变体
预生成 10,000+ 张，允许复用（永远不会用完）

npx tsx scripts/generate-covers.ts
  → HashLips 生成 → Turbo SDK 批量上传 Arweave → score_covers 表
  → 支持中断续传

铸造时分配：
  SELECT id, arweave_tx FROM score_covers ORDER BY usage_count ASC LIMIT 1 FOR UPDATE SKIP LOCKED
  UPDATE usage_count = usage_count + 1
```

---

## 十、Arweave

```
用户无感，后端全包。Turbo SDK 信用卡支付，无需 AR 代币。
合约 URI 格式：ar://txid（不绑定特定网关）

★ 多网关 fallback（src/lib/arweave.ts）：
  arweave.net → ar-io.dev → g8way.io → 可配置扩展

费用：音乐 ~$15 + 封面 ~$20 = ~$35 一次性
```

---

## 十一、运营

### 每周上架

```bash
npx tsx scripts/upload-track.ts --track-number 12 --audio ./tracks/012.mp3 --title "曲名"
```

### 空投（第 36/72/108 首）

```bash
npx tsx scripts/airdrop.ts export-addresses --round 1
npx tsx scripts/airdrop.ts dry-run --round 1 --network sepolia
npx tsx scripts/airdrop.ts execute --round 1 --network mainnet
```

### 自动化

| 任务 | 频率 | 方式 |
|------|------|------|
| 铸造队列 | 每 1 分钟 | Vercel Cron |
| 链上同步 | 每 5 分钟 | Vercel Cron |
| 余额检查 | 每小时 | Vercel Cron + Telegram |
| 过期乐谱 | 每小时 | pg_cron |
| 失败任务 | 每小时 | pg_cron |

### 运营成本预算

```
== 免费 ==
Vercel Hobby:      $0（API Route 10s 超时，Phase 1 够用）
Supabase Free:     $0（500MB，50k 行）
Alchemy Free:      $0
Privy Free:        $0（1,000 MAU）

== 必须付费 ==
域名:              ~$12/年
香港服务器:         $5-20/月（国内反代）
ETH Gas:           $50-200/月（取决于铸造量，合约每日上限控制）
Arweave:           ~$35 一次性

== 月均成本（初期）==
$55-220/月

== 用户增长后升级 ==
Vercel Pro:        $20/月（60s 超时）
Supabase Pro:      $25/月（备份）
独立 Worker:       $5/月（队列延迟不够时）
```

---

## 十二、项目退出策略

```
两年后 108 首全部完成：

★ 低成本维持模式（推荐）：
  保留 Vercel Hobby + Supabase Free
  铸造切换为"用户自付 Gas"模式（前端连钱包签名，传统 dApp）
  停掉运营钱包、Worker、付费服务
  运营成本 → $0

★ Score Decoder（项目运营期间开发）：
  一个单文件 HTML，开源到 GitHub
  输入 ScoreNFT tokenId → 从 Arweave 读 Metadata → Web Audio API 回放
  即使网站关闭，任何人可以独立部署复现合奏
  这是"永久可复现"承诺的兑现

★ 数据永久性保证：
  Arweave 上的音频+Metadata = 永久
  以太坊主网合约 = 永久
  Score Decoder 开源 = 永久可用
  三者结合 = 完整复现，不依赖任何中心化服务
```

---

## 十三、开发阶段

### Phase 1：MVP（目标：1 首歌跑通全链路）

```
数据库：001_initial_schema.sql（4 张表）
合约：MaterialNFT 部署到 Sepolia
服务：Vercel Hobby + Supabase Free

- [ ] 项目初始化
- [ ] 群岛单岛屿 + 呼吸动画
- [ ] 首次引导（FirstVisitGuide）
- [ ] 单曲播放 + 底部播放条
- [ ] Privy 登录
- [ ] MaterialNFT 合约（Sepolia，含 allowlist + 每日上限）
- [ ] POST /api/mint/material → 写队列 → 立即返回
- [ ] Vercel Cron process-mint-queue → 串行铸造
- [ ] 乐观 UI：点击即成功
- [ ] 个人页基础版（已铸造列表）
- [ ] 端到端测试
```

### Phase 2：合奏 + 群岛完整版

```
数据库：002_jam_and_scores.sql
★ 开始前先做 Patatap spike（1 天）

- [ ] Patatap 集成（或自建简化版）
- [ ] 群岛多岛屿 + 悬停预览 + 铸造标记 + 视觉暗示
- [ ] 合奏录制 + ScorePreview 自动预览
- [ ] 乐谱暂存 + pending_scores 状态机
- [ ] 24h TTL 可视化（沉入水面 + 过期海底动画）
- [ ] 过期前邮件提醒
- [ ] pg_cron 定时任务
```

### Phase 3：乐谱 NFT + 封面 + 分享

```
数据库：003_covers_and_airdrops.sql
★ 艺术家提前准备图层素材

- [ ] 封面图：图层 → HashLips → Arweave → score_covers
- [ ] ScoreNFT + MintOrchestrator 部署（Sepolia）
- [ ] ERC-6551 TBA（含 fallback 开关）
- [ ] 队列支持 score mint（Arweave 上传 → 封面分配 → 合约铸造）
- [ ] mint_events.score_data 自包含
- [ ] ScorePlayer 回放 + 公开回放页 /score/[tokenId]（OG tags）
- [ ] ShareCard + 一键复制链接
- [ ] 唱片架（RecordShelf）
- [ ] OpenSea Metadata 验证
- [ ] 链上事件同步 Cron
```

### Phase 4：社区钱包 + 空投 + 完善

```
数据库：004_community_auth.sql

- [ ] 社区 API 封装 + 5s 超时降级
- [ ] 自签 JWT（仅社区用户）+ 后端双验证
- [ ] LoginModal 社区入口
- [ ] 艺术家页面动态化
- [ ] 空投"开箱"体验
- [ ] 余额检查 Cron + Telegram 告警
- [ ] 健康检查端点
```

### Phase 5：主网 + 安全 + 退出准备

```
- [ ] 合约部署到主网（含 allowlist 配置）
- [ ] 运营钱包冷热分离
- [ ] 私钥环境隔离（Production vs Preview）
- [ ] 香港 Nginx 反向代理
- [ ] 安全审计
- [ ] 响应式适配
- [ ] Score Decoder 开源工具开发
- [ ] 低成本维持模式准备（用户自付 Gas 切换开关）
```

---

## 十四、关键决策

| 决策 | 理由 |
|------|------|
| Phase 1 用 Vercel Cron 而非独立 Worker | 一个人项目减少运维，用户量大了再迁移 |
| Privy JWT 直接使用 | 不自建一套 JWT，减少一半认证复杂度 |
| 数据库按 Phase 递增 | 不在 Phase 1 就建 12 张表 |
| 合约全局每日 mint 上限 | 防突然爆火烧光 Gas |
| 封面图允许复用 | 永远不会用完，封面不是核心价值 |
| ERC-6551 设 fallback 开关 | 未定稿标准是最大技术赌注 |
| 乐观 UI | 用户秒级反馈，后台异步上链 |
| ISR 缓存 tracks | 数据库故障时浏览仍可用 |
| mint_events.score_data 自包含 | 不依赖 pending_scores 外键 |
| 低成本维持模式 | 两年后切换到用户自付 Gas，运营成本 → $0 |
| Score Decoder 开源 | 兑现"永久可复现"承诺 |
| Patatap spike 先行 | 2014 年库集成风险，Phase 2 前验证 |
