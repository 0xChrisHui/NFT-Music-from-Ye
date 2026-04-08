# STATUS — 项目当前状态

> 这是给"人 + AI"共用的状态面板。AI 每次完成一个小闭环都要更新这里。
> 字段简短，不要超过 30 行。详细历史看 git log。

---

## 当前阶段

**Phase**: Phase 0 — Minimal Closed Loop
**目标**: 1 天内跑通 "前端 → API → 队列 → 链上 1 笔 mint"

## 当前进度

**做到哪**: Day 1 地基已完成（文档骨架 + 5 hooks + 3 scripts + QUICKSTART）
**下一步**: Phase 0 Step 0 — 跑 `scripts/doctor.sh` 检查环境
**playbook**: `playbook/phase-0-minimal.md`

## 上次成功验证

- 验证内容: 还未开始
- 验证时间: —
- 验证方式: —
- 通过的 commit: —

## 当前阻塞

- 无

## 备注（AI 写给下次会话的自己）

- 项目代号 `nft-music`，产品名 `108 Cyber Records`，文档用产品名
- Next.js 版本是 16.1.6（不是 ARCHITECTURE.md 写的 14），React 19
- Windows 环境，hooks 用 Git Bash 跑
- 学习模式: slow mode（默认）
- 学习机制 hooks 已就位：SessionStart 自动注入 STATUS/TASKS，Stop 在有未提交改动时打印自检清单
- check-folder-size hook 已加项目根目录例外（含 package.json + .git 的层）
- 当前在 worktree `quirky-herschel` 里工作，但所有 commit 都进 main 分支
