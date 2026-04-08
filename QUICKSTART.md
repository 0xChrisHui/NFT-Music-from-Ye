# QUICKSTART — 5 分钟跑起来

> 给项目新人（包括未来的你自己）的最短路径：从 0 到看见浏览器里的页面。
>
> 完整文档导航在 [README.md](./README.md)。

---

## 你将得到什么

跟着这份文档做完，你会有：

- 一个能本地跑起来的 Next.js dev server
- 装好的开发工具链（Node / Git）
- 通过 `doctor.sh` 体检的环境
- 知道下一步该读哪份文档

**预计时间**：第一次 15 分钟（等 npm install），之后每次 1 分钟。

---

## Step 1：装基础工具

### Windows 用户（你大概率是这个）

1. **Git for Windows** — https://git-scm.com/download/win
   装完之后右键任意文件夹应该能看到 "Git Bash Here"。**本项目所有命令都在 Git Bash 里跑，不在 cmd / PowerShell 里跑**。
2. **Node.js LTS 版本** — https://nodejs.org/
   选 "LTS"（推荐版），不要选 "Current"。装完打开 Git Bash 输入 `node -v`，看到一个 v20.x 之类的版本号就成。

### macOS 用户

```bash
# 用 Homebrew 一次装两个
brew install git node
```

### Linux 用户

```bash
# Debian/Ubuntu
sudo apt install git nodejs npm
```

---

## Step 2：装项目依赖

```bash
# 进入项目目录
cd /e/Projects/nft-music   # Windows 在 Git Bash 里这么写
# 或者 cd ~/projects/nft-music （Mac/Linux）

# 装依赖（第一次会下载 200MB 左右，慢的话喝杯水等几分钟）
npm install
```

期间会看到一堆滚动的文字，正常。结束时应该看到 `added XXX packages` 之类的信息。如果看到 `npm ERR!` 红字，**先别慌，去看 [docs/ERRORS.md](./docs/ERRORS.md) 有没有同样的报错**。没有就告诉 AI 报错全文。

---

## Step 3：体检

```bash
bash scripts/doctor.sh
```

应该看到一堆 ✅，最后一行写 `环境就绪`。如果有 ❌，按提示修。常见情况：

- ❌ `node_modules 不存在` → 你忘了 `npm install`
- ❌ `Foundry` 缺失 → **Phase 0 Step 5 之前不需要管**，先继续

---

## Step 4：环境变量（暂时可以跳）

Phase 0 Step 0 之前，你**不需要**真的填环境变量。先让 dev server 跑起来再说。

到 Step 0 时再做：

```bash
cp .env.example .env.local
notepad .env.local  # 或 code .env.local
```

每个变量怎么取，[playbook/phase-0-minimal.md](./playbook/phase-0-minimal.md) Step 0 有详细引导。

---

## Step 5：跑起来

```bash
npm run dev
```

看到这样的输出就成功了：

```
  ▲ Next.js 16.x.x
  - Local:   http://localhost:3000
  ✓ Ready in 1.2s
```

打开浏览器访问 **http://localhost:3000** —— 应该看到 Next.js 默认页面（黑底白字，写着 "To get started, edit the page.tsx file"）。

**这就是 Phase 0 Step 1 的起点**。

按 `Ctrl+C` 停掉 dev server。

---

## 每天工作的流程（开发期间）

```
1. 打开 Claude Code（在项目目录里）
   → SessionStart hook 会自动注入 STATUS.md 和 TASKS.md，
     AI 知道当前做到哪、下一步是什么

2. 跟 AI 说："开始 Phase 0 Step N"
   → AI 会先输出 3 句话简报（slow mode）
   → 然后写代码 / 改文件
   → 最后让你在浏览器验证

3. 你在浏览器看，确认成功
   → 跟 AI 说"成功"或"看到了"

4. AI 会引导你 commit
   → 用 git 或 bash scripts/checkpoint.sh

5. 完成一个 step → 回到第 2 步开下一个
```

**重要原则**：AI 写一个文件就停，等你确认。**别让它一口气写 5 个文件**，那样出错很难定位。

---

## 遇到问题怎么办

| 情况 | 去哪儿 |
|---|---|
| 报错看不懂 | [`docs/ERRORS.md`](./docs/ERRORS.md) — 项目"错误博物馆"，搜过往同类报错 |
| 不知道命令怎么敲 | [`docs/COMMANDS.md`](./docs/COMMANDS.md) — 命令速查 |
| 不知道某个概念 | [`docs/LEARNING.md`](./docs/LEARNING.md) — 概念词典 |
| AI 写了违规代码 | hooks 会自动拦，直接看终端报的红字 |
| AI 改坏了一堆文件 | `git status` 看哪些被改 → `git restore <file>` 还原单个文件 |
| 想保存当前进度 | `bash scripts/checkpoint.sh "描述"` |

**永远不要敲**：`git reset --hard`、`git checkout .`、`git push --force`（会丢工作）。

---

## 下一步读什么

按这个顺序：

1. **[STATUS.md](./STATUS.md)** — 当前做到哪
2. **[TASKS.md](./TASKS.md)** — 接下来该做什么
3. **[playbook/phase-0-minimal.md](./playbook/phase-0-minimal.md)** — Phase 0 完整路线（8 步）
4. **[AGENTS.md](./AGENTS.md)** — AI 怎么跟你协作（你不用全读，但知道有这份）
5. **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — 完整技术架构（**先别读**，等 Phase 0 跑通了再看）

---

## 一句话总结

**安装 → `npm install` → `bash scripts/doctor.sh` → `npm run dev` → 浏览器 → 跟 AI 说"开始 Phase 0 Step 0"。**

剩下的 AI 会带着你做。
