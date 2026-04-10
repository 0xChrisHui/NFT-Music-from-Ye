# ERRORS — 错误博物馆

> 每次遇到报错，AI 在修复后会自动追加一条记录到这里。
> 4 个月后回头看，这是你"闯关史"的完整地图。
>
> **格式**：每条 5 段
> - 📅 日期 + 触发的 Step
> - 😱 报错原文（粘贴 stack trace 关键部分）
> - 🧠 为什么会错
> - 🔧 怎么修的
> - 💡 学到的（一句话原则，可以反复套用的）
>
> **编号规则**：E001, E002, ... 从 001 起递增

---

## 🎯 这份文件的价值

错误是**学习最深**的时刻。大脑在看到红色 stack trace 时会高度专注，
此时记下"为什么 + 怎么修 + 原则"，比读 10 篇教程都有效。

第二次遇到相似的错误，你会直觉地搜这份文件，往往 1 秒钟解决。

---

## 📖 错误正文

> 按时间顺序追加。

---

### E001 — Tailwind v4 `Invalid code point 12675409`

- 📅 2026-04-10 / Phase 2 Step 0（合奏 spike）

- 😱 `RangeError: Invalid code point 12675409` at `tailwindcss/dist/lib.js` → `markUsedVariable`

- 🧠 Tailwind v4 默认扫描整个项目目录。`.claude/logs/` 里的日志文件含 Windows 路径如 `\c16951a6...`，Tailwind 的 CSS 转义解析器把 `\c16951` 当成十六进制转义，算出超范围 Unicode code point（12675409 > 0x10FFFF）崩溃。

- 🔧 白名单方式限制 Tailwind 扫描范围：`@import "tailwindcss" source(none);` + `@source "app/**/*"; @source "src/**/*";`

- 💡 Windows 路径的反斜杠 + 十六进制字符会被 CSS 解析器误读。Tailwind v4 扫描范围用白名单比黑名单可靠。

---

### E002 — Cursor 执行 `git checkout` 还原 globals.css

- 📅 2026-04-10 / Phase 2 Step 0

- 😱 通过 CLI/终端修改的 `globals.css` 修复内容，约 2-6 分钟后被还原成 git 中的旧版。ProcMon 抓到是 `git.exe checkout app/globals.css`。

- 🧠 Cursor 编辑器检测到 git 仓库后，会在后台执行 `git checkout` 恢复文件到 git 版本。只要 git 里的版本是旧的，Cursor 就会反复还原。

- 🔧 把修复提交到 git（`git commit`），这样 Cursor 的 `git checkout` 恢复的就是正确版本。

- 💡 外部修改被 git tracked 的文件后，必须及时提交，否则 Cursor 等编辑器可能通过 git 还原。

---

### E003 — 背景音乐快速点击叠加

- 📅 2026-04-10 / Phase 2 Step 0

- 😱 快速连续点击"播放背景"按钮，会触发多条音轨同时播放。

- 🧠 `startBg` 是异步函数（fetch + decode），第一次点击还没完成时 `bgPlaying` 还是 false，第二次点击又触发一次 `startBg`。

- 🔧 加 `bgLoadingRef` 锁，进入时检查、退出时释放。同时在 startBg 开头停掉旧的 source。

- 💡 异步操作的开关按钮必须加锁，React 的 state 更新是异步的，不能依赖 state 做互斥。

---

## 🏷 错误索引（按类型）

随着错误积累，AI 会在这里维护一份按类型分类的索引：

### 浏览器 / Web API
- E003 背景音乐快速点击叠加

### Next.js / React
- E001 Tailwind v4 扫描 `.claude/logs/` 导致 Invalid code point
- E002 Cursor autoSave 覆盖外部修改

### TypeScript
- （空）

### 数据库 / Supabase
- （空）

### 区块链 / viem
- （空）

### 网络 / API
- （空）

### Git / 工具链
- （空）
