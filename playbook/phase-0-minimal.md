# Phase 0 — Minimal Closed Loop

> 🎯 **目标**：1 个工作日内（约 6 小时）跑通 "前端 → API → 队列 → 链上 1 笔 mint" 的完整技术主路。
>
> 🚫 **不包含**：底部播放条 / 个人页 / 首次引导 / 多岛屿 / 封面图 / 乐谱 / 合奏 / 分享卡 / Vercel Cron 配置 / 部署到 Vercel
>
> ✅ **完成标准**：你能在 Sepolia Etherscan 上看到一笔由本项目铸造的 NFT 交易。

---

## 📖 总览

| Step | 时长 | 做什么 | 验证 |
|---|---|---|---|
| 0 | 30 min | 环境健康检查 + 注册账号 | `doctor.sh` 全绿 |
| 1 | 20 min | Next.js 调整深色首页 | 浏览器看到深色页 |
| 2 | 60 min | Island 组件 + 点击播放 mp3 | 点击圆，听到声音 |
| 3 | 45 min | Privy 登录拿到 evm_address | 登录后 console 打印地址 |
| 4 | 20 min | Supabase 建 2 张表 | Dashboard 看到表 |
| 5 | 90 min | MaterialNFT 合约部署 Sepolia | Etherscan 看到合约 |
| 6 | 60 min | POST /api/mint/material | curl 调用返回 200 |
| 7 | 30 min | 手动触发 cron 端点 | 队列 status 变 success |
| 8 | 15 min | Etherscan 看到 tx | 🎉 |

总计：约 6 小时纯执行 + 等待

---

## 🧭 阅读说明

每个 Step 用统一格式：

- **🎯 目标**：这次要得到什么结果
- **📦 范围**：允许改的文件
- **🚫 禁止**：哪些文件/模块不能碰
- **✅ 完成标准**：看到什么算成功
- **🔍 验证命令**：跑什么 / 看哪个页面
- **⏪ 回滚点**：失败时回到哪
- **📖 概念简报**（slow mode）：3 句话介绍核心概念
- **🤖 AI 执行指引**：给 AI 的具体指令
- **📝 复述问题**（slow mode）：完成后用一句话复述

---

# Step 0：环境检查 + 账号注册

## 🎯 目标
确认 Node / Git / Foundry 装好；注册 Privy / Supabase / Alchemy 账号；准备 Sepolia 测试钱包。

## 📦 范围
- 创建 `.env.example`
- 创建 `.env.local`（不入 git）

## 🚫 禁止
- 不动 `package.json`
- 不装任何 npm 包

## ✅ 完成标准
- `bash scripts/doctor.sh` 输出 ≥ 12 个 ✅，0 个 ❌（warning 可以有）
- `.env.local` 里有真实的 Privy App ID / Supabase URL / Alchemy RPC / 测试钱包私钥
- 测试钱包在 Sepolia 上有 ≥ 0.05 ETH（去 https://sepoliafaucet.com 领）

## 🔍 验证命令
```bash
bash scripts/doctor.sh
```

## ⏪ 回滚点
环境配置失败不需要 git 回滚，删 `.env.local` 重做就行。

## 📖 概念简报（slow mode）
1. **环境变量**：放在 `.env.local` 的 key=value，前缀 `NEXT_PUBLIC_` 的会暴露给前端，没前缀的只在后端能看到
2. **Sepolia**：以太坊的"练习场"，水龙头免费发测试 ETH，玩坏了不心疼
3. **私钥 vs 地址**：地址是公开的（像微信号），私钥是密码（千万不能泄露），有私钥就能动这个地址里的钱

## 🤖 AI 执行指引

```
1. 先跑 bash scripts/doctor.sh 看现状
2. 创建 .env.example，包含以下变量（每个加中文注释）：
   - NEXT_PUBLIC_PRIVY_APP_ID
   - PRIVY_APP_SECRET
   - NEXT_PUBLIC_CHAIN_ID  (默认 11155111 = Sepolia)
   - NEXT_PUBLIC_ALCHEMY_RPC_URL
   - ALCHEMY_RPC_URL
   - OPERATOR_PRIVATE_KEY
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - CRON_SECRET
3. 检查 .gitignore 是否含 .env.local，如果没有就追加
4. 告诉用户去注册 Privy / Supabase / Alchemy，把值填到 .env.local
5. 等用户说"填好了"再继续
6. 跑 doctor.sh 确认通过
```

## 📝 复述问题（slow mode）
> 为什么 .env.local 不能 commit 到 git？

---

# Step 1：深色首页

## 🎯 目标
把 Next.js 默认首页清空，换成深色全屏背景。

## 📦 范围
- `app/page.tsx`（已有）
- `app/globals.css`（已有，可能需要微调）

## 🚫 禁止
- 不动 `app/layout.tsx` 的结构
- 不删 `app/` 目录任何已有文件
- 不创建新组件（Step 2 才建）

## ✅ 完成标准
- 浏览器打开 http://localhost:3000 看到一个**全屏深色**页面
- 中央有一行白色小字 "108 Cyber Records"
- 没有任何报错

## 🔍 验证命令
```bash
npm run dev
# 浏览器打开 http://localhost:3000
```

## ⏪ 回滚点
失败回到 Step 0 末尾的 commit。

## 📖 概念简报（slow mode）
1. **App Router**：Next.js 16 用的路由系统，`app/page.tsx` 就是首页（不是 `pages/index.tsx`）
2. **Tailwind CSS**：用 className 写样式的工具，比如 `bg-black text-white` = 黑色背景白色文字
3. **Server Component**：默认情况下 `page.tsx` 是 server component，在服务器渲染好 HTML 再发给浏览器

## 🤖 AI 执行指引

```
1. 读 app/page.tsx 当前内容
2. 清空里面的 <main>，换成：
   - 全屏深色背景 (bg-neutral-950 或类似)
   - flex 居中
   - 一个 <h1> 显示 "108 Cyber Records"
3. 文件 ≤ 50 行
4. 跑 npm run dev 确认能打开
5. 让用户在浏览器确认看到深色页面
6. 用户确认后 commit:
   feat(ui): 深色首页 [concepts: app-router, tailwind]
```

## 📝 复述问题（slow mode）
> Next.js 的 app/page.tsx 和 React 的普通组件有什么区别？

---

# Step 2：Island 组件 + 点击播放

## 🎯 目标
首页中央有一个会呼吸的圆形（Island 组件）。点击它播放一首本地 mp3 文件。

## 📦 范围
- 新建 `src/components/archipelago/Island.tsx`
- 新建 `src/hooks/useAudioPlayer.ts`
- 修改 `app/page.tsx`
- 在 `public/tracks/001.mp3` 放一首 mp3（用户准备）

## 🚫 禁止
- 不写 BottomPlaybar（Phase 1 才做）
- 不引入任何音频库（用 Web Audio API）
- 不创建 src/lib/ 等其他目录

## ✅ 完成标准
- 浏览器看到深色页 + 中央一个柔和蓝色的圆，缓慢"呼吸"
- 点击圆 → 听到 001.mp3 播放
- 再次点击 → 停止
- 控制台没有报错

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
# 浏览器点击圆
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/
```

## 📖 概念简报（slow mode）
1. **AudioContext**：浏览器的音频引擎。**必须**在用户点击之后才能创建，否则浏览器会拒绝（防止广告网站自动播放）
2. **React Hook**：以 `use` 开头的函数，能让组件复用状态逻辑。`useAudioPlayer` 把音频逻辑封装起来
3. **'use client'**：放在文件顶部的标记，告诉 Next.js "这是浏览器组件，不是服务器渲染"。任何用 hooks / 事件的组件都需要

## 🤖 AI 执行指引

```
0. 提醒用户在 public/tracks/ 放一首叫 001.mp3 的文件（任意 mp3）

1. 创建 src/hooks/useAudioPlayer.ts:
   - 'use client'
   - 维护一个 useRef AudioContext 单例
   - 提供 play(url) 和 stop() 函数
   - play 内部: 如果 ctx 不存在就 new AudioContext()，再 fetch + decodeAudioData + AudioBufferSourceNode
   - 同一时间只播一首，新播放停掉旧的
   - isPlaying 状态
   - ≤ 100 行

2. 创建 src/components/archipelago/Island.tsx:
   - 'use client'
   - 200x200 圆形 div
   - 蓝色径向渐变 (bg-radial-gradient 或自定义)
   - Tailwind animate-pulse 呼吸动画
   - 接收 onClick prop
   - ≤ 60 行

3. 修改 app/page.tsx:
   - 改成 'use client' (因为要用 hook)
   - 导入 Island 和 useAudioPlayer
   - 中央渲染 Island，onClick 时 toggle 播放 /tracks/001.mp3

4. 跑 verify.sh
5. 让用户在浏览器测试
6. commit:
   feat(ui): Island 组件 + 音频播放 [concepts: audio-context, react-hook, use-client]
```

## 📝 复述问题（slow mode）
> 为什么 AudioContext 不能在页面加载时创建，必须等用户点击？

---

# Step 3：Privy 登录

## 🎯 目标
点击右上角"登录"按钮，用邮箱登录，登录后 console 打印用户的 evm_address。

## 📦 范围
- 新建 `src/lib/privy.ts`
- 新建 `src/hooks/useAuth.ts`
- 新建 `src/components/auth/LoginButton.tsx`
- 修改 `app/layout.tsx`（加 PrivyProvider）
- 修改 `app/page.tsx`（加 LoginButton）
- `package.json` 新增依赖

## 🚫 禁止
- 不自建 JWT
- 不开启 Privy Smart Account
- 不做用户列表 / 个人页

## ✅ 完成标准
- 右上角有"登录"按钮
- 点击 → Privy 弹窗 → 邮箱登录
- 登录成功后按钮文字变成地址前 6 后 4
- console 打印完整的 evm_address (0x...)
- 点登出能登出

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/ package.json package-lock.json
rm -rf node_modules && npm i
```

## 📖 概念简报（slow mode）
1. **Privy**：第三方登录服务，用户用邮箱/Google 登录，Privy 在背后给他们生成一个以太坊钱包，用户感觉不到区块链
2. **JWT (JSON Web Token)**：登录后服务端发的"通行证"字符串，前端每次请求 API 都带着它。我们用 Privy 自带的 JWT，不自建
3. **PrivyProvider**：React Context Provider，包在 app 最外层，所有子组件都能用 `usePrivy()` 拿到登录状态

## 🤖 AI 执行指引

```
1. 安装：
   npm i @privy-io/react-auth @privy-io/server-auth
   告诉用户这两个包已加入 docs/STACK.md 白名单，本次安装合规

2. 创建 src/lib/privy.ts:
   - 导出 privyConfig 对象
   - appId 从 process.env.NEXT_PUBLIC_PRIVY_APP_ID 读
   - loginMethods: ['email']
   - embeddedWallets: { createOnLogin: 'users-without-wallets' }
   - ≤ 30 行

3. 创建 src/hooks/useAuth.ts:
   - 'use client'
   - 封装 Privy 的 usePrivy()
   - 返回 { user, isLoggedIn, isLoading, login, logout }
   - user.evmAddress 从 user.wallet.address 取
   - ≤ 50 行

4. 创建 src/components/auth/LoginButton.tsx:
   - 'use client'
   - 用 useAuth
   - 未登录显示"登录"
   - 已登录显示 0x1234...abcd
   - 登录后 console.log 完整地址（slow mode 里这是给用户验证用的）
   - ≤ 60 行

5. 修改 app/layout.tsx:
   - 'use client' （或者用单独的 client provider 文件）
   - 包裹 <PrivyProvider config={...}>
   - ≤ 50 行

6. 修改 app/page.tsx:
   - 右上角加 <LoginButton />
   - 用 absolute top-4 right-4 定位

7. 跑 verify.sh
8. 让用户在浏览器测试登录全流程
9. 用户确认后 commit:
   feat(auth): Privy 登录集成 [concepts: privy, jwt, react-context, embedded-wallet]
```

## 📝 复述问题（slow mode）
> 用户用邮箱登录后，他的"以太坊地址"是从哪里来的？

---

# Step 4：Supabase 建 2 张表

## 🎯 目标
在 Supabase Dashboard 里手动建 `users` 和 `mint_queue` 两张表。

## 📦 范围
- Supabase Dashboard 里的 SQL Editor（不在代码仓库里）
- 把 SQL 备份到 `supabase/migrations/001_initial_minimal.sql`（仅备份用）

## 🚫 禁止
- 不装 Supabase CLI
- 不本地跑 Docker
- 不一次建 4 张表（按 Phase 0 只要 2 张）

## ✅ 完成标准
- Supabase Dashboard → Table Editor 里看到 `users` 和 `mint_queue` 两张表
- `users` 表至少有：id, evm_address, privy_user_id, created_at
- `mint_queue` 表至少有：id, idempotency_key, user_id, mint_type, token_id, status, retry_count, created_at
- SQL 文件备份在 `supabase/migrations/001_initial_minimal.sql`

## 🔍 验证命令
浏览器打开 Supabase Dashboard → Table Editor → 看到 2 张表

## ⏪ 回滚点
建表失败：在 Dashboard 里 DROP TABLE。SQL 文件 git checkout 还原。

## 📖 概念简报（slow mode）
1. **PostgreSQL**：一种关系数据库，把数据存在"表"里，每张表有列（字段）和行（记录）。Supabase 是托管的 PostgreSQL
2. **Primary Key (主键)**：每行的唯一标识，通常用 UUID 或自增整数。两行不能有相同的主键
3. **Foreign Key (外键)**：一张表引用另一张表的主键。例如 `mint_queue.user_id` 引用 `users.id`，建立"这条铸造任务属于哪个用户"的关系

## 🤖 AI 执行指引

```
1. 创建 supabase/migrations/001_initial_minimal.sql:
   - users 表（4 字段：id UUID, evm_address TEXT, privy_user_id TEXT UNIQUE, created_at）
   - mint_queue 表（参考 docs/ARCHITECTURE.md §4，但只取 Phase 0 必须的字段）
   - 加 idx_users_evm 和 idx_queue_status 索引
   - 这个文件只是备份，不会被自动执行

2. 告诉用户:
   "请打开 https://supabase.com/dashboard
    → 你的 project
    → SQL Editor
    → New query
    → 把 supabase/migrations/001_initial_minimal.sql 内容复制粘贴
    → 点 Run
    → 等我说下一步"

3. 等用户确认建表成功后:
   告诉用户测试一下:
   "Dashboard → Table Editor → 应该看到 users 和 mint_queue 两张表"

4. 让用户手动插入一条测试 user (Dashboard → users → Insert row):
   evm_address: 0x0000000000000000000000000000000000000001
   privy_user_id: test-user-001

5. 用户确认后 commit:
   feat(db): Supabase 建表 users + mint_queue [concepts: postgres, primary-key, foreign-key, supabase-dashboard]
```

## 📝 复述问题（slow mode）
> 为什么 mint_queue 需要一个 user_id 字段，而不是把用户信息直接写在每条记录里？

---

# Step 5：MaterialNFT 合约部署到 Sepolia

## 🎯 目标
写一个最简版的 MaterialNFT.sol，用 Foundry 部署到 Sepolia 测试网，记下合约地址。

## 📦 范围
- 新建 `contracts/` 目录（Foundry 项目）
- `contracts/src/MaterialNFT.sol`
- `contracts/test/MaterialNFT.t.sol`
- `contracts/script/Deploy.s.sol`
- `contracts/foundry.toml`

## 🚫 禁止
- 不部署 ScoreNFT（Phase 3 才做）
- 不写 MintOrchestrator（Phase 3 才做）
- 不部署到主网（永远不在 Phase 0-1 部署主网）
- 不用 Hardhat（用 Foundry）

## ✅ 完成标准
- `forge test` 全部通过
- `forge script ... --broadcast` 输出合约地址
- 合约地址在 https://sepolia.etherscan.io 上能查到
- 合约地址写入 `.env.local` 的 `NEXT_PUBLIC_MATERIAL_NFT_ADDRESS`
- 部署的钱包地址已被加入 `minters` allowlist

## 🔍 验证命令
```bash
cd contracts
forge test -vv
# 部署后:
# 浏览器打开 https://sepolia.etherscan.io/address/<合约地址>
```

## ⏪ 回滚点
合约部署失败：删 contracts/ 重建，链上的失败合约不用管（反正没花钱）。

## 📖 概念简报（slow mode）
1. **Solidity**：写以太坊合约的语言，长得像 JavaScript + Java 的混合体。一旦部署到主网就不能改
2. **ERC-1155**：以太坊标准之一，"一个 tokenId 可以有多份"（适合音乐素材：1000 个人都可以拥有第 1 首歌的"一份")
3. **allowlist**：合约里的一个 mapping，记录"哪些地址有权限调用 mint"。比 onlyOwner 更安全：即使你的部署钱包私钥泄露，黑客也只能 mint 没价值的 NFT，不能改 allowlist 本身

## 🤖 AI 执行指引

```
1. 在项目根目录跑:
   forge init contracts --no-git
   cd contracts
   forge install OpenZeppelin/openzeppelin-contracts --no-git

2. 写 contracts/src/MaterialNFT.sol:
   - SPDX-License-Identifier: MIT
   - pragma solidity ^0.8.20
   - import OpenZeppelin ERC1155 + Ownable
   - state: mapping(address => bool) public minters
   - state: uint256 public dailyMintLimit = 200
   - state: mapping(uint256 => uint256) public dailyMintedCount  (key: dayIndex)
   - event MinterUpdated(address indexed minter, bool allowed)
   - constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) {}
   - setMinter(address, bool) onlyOwner
   - mint(address to, uint256 tokenId, uint256 amount) — 检查 minters[msg.sender] + 检查 daily limit + _mint
   - modifier onlyMinter
   - ≤ 100 行

3. 写 contracts/test/MaterialNFT.t.sol:
   - 测 owner 可以 setMinter
   - 测 minter 可以 mint
   - 测 非 minter 不能 mint (vm.expectRevert)
   - 测 daily limit 超出后 revert
   - ≤ 100 行

4. 跑 forge test -vv，必须全绿

5. 写 contracts/script/Deploy.s.sol:
   - 部署 MaterialNFT，传 uri "ipfs://placeholder/{id}.json"
   - 部署后调 setMinter(deployer, true)
   - console2.log 合约地址

6. 部署到 Sepolia:
   forge script script/Deploy.s.sol \
     --rpc-url $ALCHEMY_RPC_URL \
     --private-key $OPERATOR_PRIVATE_KEY \
     --broadcast \
     -vv

7. 把输出的合约地址告诉用户，让用户加到 .env.local:
   NEXT_PUBLIC_MATERIAL_NFT_ADDRESS=0x...

8. 让用户在 sepolia.etherscan.io 上查看合约确认存在

9. 回到根目录 cd ..

10. commit:
    feat(contracts): MaterialNFT 部署 Sepolia [concepts: solidity, erc-1155, allowlist, foundry, sepolia]
```

## 📝 复述问题（slow mode）
> allowlist 比 onlyOwner 更安全的原因是什么？

---

# Step 6：POST /api/mint/material

## 🎯 目标
写一个 API 端点，前端调用它会写一条记录到 `mint_queue` 表，**立即返回**，不等链上交易。

## 📦 范围
- 新建 `src/lib/supabase.ts`
- 新建 `src/app/api/mint/material/route.ts`
- 安装 `@supabase/supabase-js`

## 🚫 禁止
- 这个 API 内**禁止** import operator-wallet（hook 会阻止）
- 这个 API 内**禁止** await waitForTransactionReceipt（hook 会阻止）
- 不在这一步做前端调用 UI（Step 7 之后再做）

## ✅ 完成标准
- 用 curl 或 Postman 发 POST → 返回 `{ result: "ok", mintId: "uuid" }`
- Supabase Dashboard → mint_queue 表 → 看到一条 status='pending' 的记录
- 同一个 idempotencyKey 第二次请求 → 返回原 mintId（不重复写）

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev

# 在另一个终端窗口:
curl -X POST http://localhost:3000/api/mint/material \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的 Privy token>" \
  -d '{"tokenId": 1, "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"}'
```

(获取 Privy token: 浏览器登录后, devtools console 跑 `await window.privy?.getAccessToken?.()` 或类似)

## ⏪ 回滚点
```bash
git checkout HEAD -- src/
```

## 📖 概念简报（slow mode）
1. **API Route**：Next.js 的后端代码。`src/app/api/foo/route.ts` 自动变成 `/api/foo` 的接口。前端用 fetch 调用它
2. **乐观 UI (Optimistic UI)**：前端假设操作会成功，立刻显示成功界面。后台异步处理真正的事情（链上交易）。这样用户感觉极快
3. **idempotency (幂等)**：同一个操作重复执行多次，结果不变。我们用一个唯一的 key 防止用户连点导致重复铸造

## 🤖 AI 执行指引

```
1. 安装:
   npm i @supabase/supabase-js
   提醒用户这是 docs/STACK.md 白名单包，合规

2. 创建 src/lib/supabase.ts:
   - 导出 supabaseAdmin (用 SUPABASE_SERVICE_ROLE_KEY)
   - 导出 supabasePublic (用 NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - ≤ 30 行
   - 注意: 这个文件不能被前端组件直接 import supabaseAdmin

3. 创建 src/app/api/mint/material/route.ts:
   - import { NextRequest, NextResponse } from 'next/server'
   - import { PrivyClient } from '@privy-io/server-auth'
   - import { supabaseAdmin } from '@/lib/supabase'
   - export async function POST(req)
   - 从 Authorization header 取 token
   - 用 PrivyClient 验证 token，拿到 userId
   - 从请求 body 拿 tokenId 和 idempotencyKey
   - 先按 idempotencyKey 查 mint_queue，存在就返回原记录
   - 不存在就 insert，status='pending'
   - 返回 { result: 'ok', mintId: <id> }
   - try/catch 包住，错误返回 500 + { error: ... }
   - ≤ 100 行
   - 绝对不能 import operator-wallet (hook 会拦)
   - 绝对不能 await waitForTransactionReceipt (hook 会拦)

4. 跑 verify.sh

5. 告诉用户怎么用 curl 测试 + 怎么从浏览器拿 Privy token

6. 用户确认后 commit:
   feat(api): POST /api/mint/material 写队列 [concepts: api-route, optimistic-ui, idempotency, jwt-verify]
```

## 📝 复述问题（slow mode）
> 为什么这个 API 不直接调合约 mint，而是写一条数据库记录就返回？

---

# Step 7：手动触发 Cron 处理器

## 🎯 目标
写一个 cron 端点，从 `mint_queue` 取一条 pending 记录，用运营钱包真的发交易上链。手动访问 URL 触发它。

## 📦 范围
- 新建 `src/lib/operator-wallet.ts`
- 新建 `src/lib/contracts.ts`
- 新建 `src/app/api/cron/process-mint-queue/route.ts`
- 安装 `viem`

## 🚫 禁止
- 这次不配 Vercel Cron（手动访问 URL 触发）
- 不在 cron 之外的地方 import operator-wallet
- 不一次处理多条（必须串行，一次一条）

## ✅ 完成标准
- 浏览器访问 `http://localhost:3000/api/cron/process-mint-queue?secret=<CRON_SECRET>`
- 返回 `{ result: "ok", processed: 1 }`
- Supabase mint_queue 那条记录 status 变成 `success`
- 多了一条 mint_events 记录（如果有这张表）or queue 记录里有 tx_hash
- Sepolia Etherscan 能看到这笔 mint 交易

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
# 浏览器访问 http://localhost:3000/api/cron/process-mint-queue?secret=...
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/
```

## 📖 概念简报（slow mode）
1. **viem**：跟以太坊交互的 TypeScript 库。我们用它从 OPERATOR_PRIVATE_KEY 创建一个钱包客户端，用这个钱包"代替用户"发交易付 gas
2. **Nonce**：以太坊每个地址的"交易序号"，必须严格递增。如果同时发两笔交易 nonce 冲突，至少一笔会失败。所以我们必须**串行**处理队列
3. **运营钱包模式**：用户不需要持有 ETH，所有 gas 都由项目方的"热钱包" (operator wallet) 付。用户只需要登录拿到地址，链上的"用户地址"接收 NFT，但发交易的是项目方

## 🤖 AI 执行指引

```
1. 安装:
   npm i viem
   提醒用户是 docs/STACK.md 白名单

2. 创建 src/lib/contracts.ts:
   - 从 process.env.NEXT_PUBLIC_MATERIAL_NFT_ADDRESS 读地址
   - 导出 materialNftAbi（最小子集：只 mint 函数）
   - ≤ 30 行

3. 创建 src/lib/operator-wallet.ts:
   - import { createWalletClient, http } from 'viem'
   - import { sepolia } from 'viem/chains'
   - import { privateKeyToAccount } from 'viem/accounts'
   - 导出 operatorWalletClient
   - 顶部加注释 "// SERVER ONLY - do not import from frontend"
   - ≤ 30 行

4. 创建 src/app/api/cron/process-mint-queue/route.ts:
   - GET 方法
   - 验证 query 参数 secret === process.env.CRON_SECRET (返回 401 if not)
   - 从 mint_queue 取一条 status='pending' 的最早记录
   - 没有就返回 { result: 'ok', processed: 0 }
   - 有就:
     - update status 'minting_onchain'
     - 从 users 表查 evm_address
     - 调 operatorWalletClient.writeContract({ address, abi, functionName: 'mint', args: [evmAddress, tokenId, 1] })
     - 拿到 txHash
     - waitForTransactionReceipt (这里 OK 因为是 cron，不是 API Route)
     - update status 'success', tx_hash
     - 失败 retry_count++, 还能重试就回到 pending
   - 一次只处理一条
   - try/catch 包住
   - ≤ 150 行（如果太长拆 helper 到 src/lib/）

5. 跑 verify.sh

6. 引导用户:
   - 在浏览器先登录
   - 用 curl 调 Step 6 的 API 创建一条 pending 记录
   - 然后浏览器访问 cron URL 触发处理
   - 检查 Supabase mint_queue
   - 检查 sepolia.etherscan.io

7. 用户确认看到链上 tx 后 commit:
   feat(cron): process-mint-queue 串行处理铸造 [concepts: viem, nonce, operator-wallet, queue-processor]
```

## 📝 复述问题（slow mode）
> 为什么 cron 处理器一次只能处理一条 mint，不能并发？

---

# Step 8：验证完整链路 + 庆祝

## 🎯 目标
确认前端 → API → 数据库 → cron → 链上 整条主路是通的。截图 / 录屏作为里程碑。

## 📦 范围
- 不写代码
- 跑一次完整流程
- 写 `STATUS.md` 标记 Phase 0 完成

## ✅ 完成标准
- 你能在 sepolia.etherscan.io 上看到一笔 `Transfer` 事件，from 0x0, to 你的钱包地址
- 你能用一句话告诉别人 "我刚才铸造了一个 NFT"
- `STATUS.md` 里 Phase 0 标记为完成
- TASKS.md Done 区有 "Phase 0 全部 8 步"

## 🔍 验证命令
```bash
# 1. 启动 dev
npm run dev

# 2. 浏览器登录

# 3. 用 curl 调 mint API
curl -X POST http://localhost:3000/api/mint/material \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"tokenId": 1, "idempotencyKey": "<新 uuid>"}'

# 4. 浏览器访问 cron
http://localhost:3000/api/cron/process-mint-queue?secret=<...>

# 5. 浏览器打开 Supabase Dashboard 看 mint_queue 状态

# 6. 浏览器打开 sepolia.etherscan.io/tx/<tx_hash>
```

## ⏪ 回滚点
失败：回到 Step 7 commit，对照流程一段一段查。

## 📖 概念简报（slow mode）
**这是一个里程碑！** 你刚才完成的是 Web3 应用的核心架构：
1. 用户通过 Web2 方式（邮箱）登录
2. 前端不持有任何私钥，所有链上操作都通过后端
3. 后端用"队列 + 异步处理"模式，让用户感觉极快（乐观 UI）
4. 真正的链上交易由"运营钱包"代签代付

这个架构会一直用到 Phase 5。后面所有功能（合奏、乐谱、空投）都是在这条主路上加东西。

## 🤖 AI 执行指引

```
1. 引导用户跑一遍完整流程
2. 帮用户解读 Etherscan 上的 transaction
3. 更新 STATUS.md:
   - Phase: Phase 0 ✅ 完成
   - 当前进度: 等待开始 Phase 1
   - 上次成功验证: <填实际时间和 tx hash>
4. 更新 TASKS.md:
   - 把 Phase 0 Step 0-8 全部移到 Done
   - 在 Now 加: "等待用户决定: 是否开 Codex 做第一次 review"
5. 用 scripts/checkpoint.sh 创建 checkpoint:
   bash scripts/checkpoint.sh "Phase 0 完成 — 第一笔 mint 上链"
6. 在 docs/LEARNING.md 顶部加一段:
   "🎉 2026-04-XX: Phase 0 完成。当前已经掌握的概念: <列出>"
```

## 📝 复述问题（slow mode）
> 用你自己的话告诉一个不懂代码的朋友: 你刚才做了什么？

---

# 🎊 Phase 0 完成后

Codex review 流程：

1. 打开 Codex
2. 让 Codex 读：
   - `AGENTS.md`
   - `STATUS.md`
   - `docs/CONVENTIONS.md`
   - 最近 8-10 个 commit 的 diff
3. Codex 输出到 `reviews/2026-04-XX-phase-0.md`
4. 回到 Claude Code，根据 review 修复问题
5. 用户决定是否进入 Phase 1

Phase 1 的 playbook 之后会在 `playbook/phase-1/` 目录里展开，目前还没写。

---

## 📌 整个 Phase 0 的"地图"

```
[环境就绪] → [深色页] → [圆 + 音频] → [登录] → [建表]
                                                    ↓
[庆祝🎉] ← [触发链上] ← [写队列 API] ← [部署合约]
```

每个箭头都是一次 commit。8 个 commit 之后，你拥有一个能 mint NFT 的 Web3 应用。
