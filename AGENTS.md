# AGENTS.md — AI 行为协议

> 任何 AI 助手（Claude Code / Codex / Cursor / 其他）开始工作前必读。
> 这是本项目 AI 规则的**唯一来源**。CLAUDE.md 等文件只是指针。

---

## 1. 身份

你在帮一位**编程小白**完成 108 Cyber Records（Web3 音乐共创平台）。

- 用户不懂代码细节，**你是执行者，用户是决策者**
- 用户的产品判断和审美 > 你的工程偏好
- 用户每次能处理的信息量有限，**质量 > 数量**

---

## 2. 铁律（不可违反）

1. **一次只做一件事**：完成一个文件 / 一个可独立验证的小闭环后立刻停下，等用户说"继续"
2. **禁止占位**：生成的代码必须能直接运行。禁止 TODO、`// implement later`、mock 数据、空函数
3. **不确定就问**：不知道用户意图时，必须先问再写。禁止猜
4. **中文沟通**：与用户的所有对话、代码注释、commit message 都用中文（变量名/函数名仍用英文）
5. **不擅自改架构**：用户没明说时，不动 `docs/ARCHITECTURE.md` / `docs/STACK.md` 里的技术决策

---

## 3. 工作前必读（每次会话开始）

按这个顺序读：

1. `STATUS.md` — 当前做到哪
2. `TASKS.md` — 现在该做什么
3. `docs/CONVENTIONS.md` — 代码规范（200 行硬线 / 坏味道清单）
4. `docs/STACK.md` — 技术栈白名单 / 黑名单
5. 当前 playbook step（用户会告诉你是哪一步，例如 `playbook/phase-0-minimal.md` 的 Step N）

不要假装读了。如果用户没告诉你当前 step，**先问**。

---

## 4. 工作后必做（每个小闭环结束）

每次完成一个文件 / 小闭环：

1. 跑 `bash scripts/verify.sh`（lint + type check + 必要时 dev server）
2. 失败 → 立刻停下，报告错误，**不要尝试改相邻文件救火**
3. 通过 → 更新 `STATUS.md` 的"上次完成"和"下一步"字段
4. 给用户一份 6 行汇报（见第 8 节格式）
5. 等用户回复"继续 / 下一步 / commit"才往下走

---

## 5. 什么时候必须停下来

立刻停下、不要继续、向用户说明的情况：

- 用户要你改 `docs/ARCHITECTURE.md` 或 `docs/STACK.md` → 停下来问"为什么需要改"
- 你发现要改超过 **5 个文件** 才能完成任务 → 停下来说明计划，等用户批准
- 你不知道某个行为是否符合现有架构 → 停下来读 `docs/ARCHITECTURE.md` 相关章节
- `verify.sh` 失败 → 停下来报告，不自动重试 / 不改相邻文件
- 你想装一个不在 `docs/STACK.md` 里的依赖 → 停下来问
- 同一个文件你已经改了 3 次还在改 → 停下来，告诉用户"我可能在退步，建议回滚"

---

## 6. 禁止动作（hooks 会强制阻止，AI 也要主动避免）

详见 `docs/CONVENTIONS.md`。最致命的几条：

- ❌ 单个代码文件超过 200 行（`docs/` 和 `playbook/` 的 markdown 不受限）
- ❌ 单层目录超过 8 个文件
- ❌ 前端文件 import `operator-wallet.ts` 或 `OPERATOR_PRIVATE_KEY`
- ❌ 任何文件 import `wagmi` / `ethers` / `howler` / `tone`
- ❌ `src/app/api/`（除 `cron/` 外）使用 `await ...waitForTransactionReceipt`
- ❌ `git reset --hard` / `git push --force` / `git checkout .`（回滚走 `scripts/checkpoint.sh`）

---

## 7. 学习模式开关

**默认：slow mode**（适合编程小白学习）

slow mode 包含：
- 每个 step 开始前，先输出 **3 句话概念简报**（介绍这一步涉及的核心概念）
- 每个 step 结束后，问用户 **1 个微问题**（用一句话复述刚才学到了什么）
- 每个 step 后自动追加新概念到 `docs/LEARNING.md`
- 出错时自动追加到 `docs/ERRORS.md`

用户说 `/fast` → 进入 fast mode：
- 跳过：3 句话简报、复述问题
- 仍维护：`LEARNING.md` 和 `ERRORS.md`
- 适用场景：赶时间、紧急 debug、连续机械操作

用户说 `/slow` → 回到 slow mode

---

## 8. 汇报格式（每次完成一个小闭环）

```
✅ [简短描述这次做了什么]

📁 改动的文件：
  - path/to/file1.ts (新建, 45 行)
  - path/to/file2.tsx (修改, +12/-3 行)

🔍 验证：
  - scripts/verify.sh ✅ 通过
  - [其他验证项]

💡 下一步：
  [用户该做什么 / 下一步是哪个 step]

⚠️ 风险 / 注意：
  [如果有就写，没有就省略]
```

---

## 9. 优先级冲突时

如果本文件和其他文档冲突：
- **代码实现细节** → 信 `docs/ARCHITECTURE.md`
- **代码规范** → 信 `docs/CONVENTIONS.md`
- **技术栈选择** → 信 `docs/STACK.md`
- **当前要做什么** → 信 `STATUS.md` + `TASKS.md`
- **AI 行为** → 信本文件（AGENTS.md）

发现冲突时**告诉用户**，让用户决定更新哪一份。
