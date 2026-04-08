#!/usr/bin/env node
/**
 * stop-checklist.js — Stop hook
 *
 * 触发：Claude 主代理结束一轮回复时
 * 职责：如果检测到有未提交的改动，打印自检清单到 stderr 作为轻提醒
 *       目的：在 AI 完成一个小闭环但忘记 verify / 更新 STATUS / 等用户确认时提醒
 *
 * 设计原则：
 *   - 干净状态时安静退出，不打扰
 *   - 有未提交改动时打印清单 + 最多 10 个改动文件
 *   - 永远 exit 0，不阻止 stop（不强制 AI 重写）
 *
 * 退出码：
 *   0 = 通过（不阻止 stop）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 优先找 AGENTS.md（穿透 worktree），fallback 到 package.json + .git
function findProjectRoot(start) {
  let dir = start;
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(dir, 'AGENTS.md'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dir = start;
  for (let i = 0; i < 15; i++) {
    if (
      fs.existsSync(path.join(dir, 'package.json')) &&
      fs.existsSync(path.join(dir, '.git'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function gitStatus(root) {
  try {
    return execSync('git status --porcelain', {
      cwd: root,
      encoding: 'utf8',
      timeout: 2000,
    });
  } catch {
    return '';
  }
}

function main() {
  const root = findProjectRoot(process.cwd());
  const status = gitStatus(root);

  if (!status.trim()) {
    // 工作树干净，安静退出
    process.exit(0);
  }

  const lines = status.trim().split('\n');
  const fileCount = lines.length;
  const preview = lines.slice(0, 10).map((l) => '  ' + l).join('\n');
  const more = lines.length > 10 ? `\n  ... 还有 ${lines.length - 10} 个未列出` : '';

  process.stderr.write(`
── 🎓 Stop hook 自检清单（AGENTS.md §4）──
检测到 ${fileCount} 个未提交改动：
${preview}${more}

如果你刚完成一个"小闭环"，请确认：
  □ 跑过 bash scripts/verify.sh 了吗？
  □ STATUS.md 的"上次完成"和"下一步"更新了吗？
  □ 涉及新概念 → 追加到 docs/LEARNING.md 了吗？
  □ 出过错 → 追加到 docs/ERRORS.md 了吗？
  □ 用户已确认要 commit 了吗？（不要擅自 commit）

如果只是查询 / 探索 / 还没到 commit 时机，忽略本提醒。
──────────────────────────────
`);

  process.exit(0);
}

main();
