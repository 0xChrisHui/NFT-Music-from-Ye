#!/usr/bin/env bash
# doctor.sh — 环境健康检查
# 用法：bash scripts/doctor.sh
# 在每次开始工作前跑一次

set -uo pipefail

OK="✅"
WARN="⚠️"
FAIL="❌"

PASS=0
WARN_COUNT=0
FAIL_COUNT=0

check() {
  local name="$1"
  local cmd="$2"
  local required="$3"  # "required" or "optional"

  if eval "$cmd" >/dev/null 2>&1; then
    local result
    result=$(eval "$cmd" 2>&1 | head -1)
    echo "$OK $name: $result"
    PASS=$((PASS + 1))
  else
    if [ "$required" = "required" ]; then
      echo "$FAIL $name: 未安装或不可用"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    else
      echo "$WARN $name: 未安装（可选）"
      WARN_COUNT=$((WARN_COUNT + 1))
    fi
  fi
}

echo "================================================"
echo "  108 Cyber Records — 环境健康检查"
echo "================================================"
echo ""

echo "── 基础工具 ──"
check "Node.js" "node -v" "required"
check "npm" "npm -v" "required"
check "Git" "git --version" "required"
check "Bash" "bash --version | head -1" "required"

echo ""
echo "── 合约工具（Phase 0 Step 5 起需要）──"
check "Foundry (forge)" "forge --version" "optional"
check "Foundry (cast)" "cast --version" "optional"

echo ""
echo "── 项目状态 ──"

if [ -f "package.json" ]; then
  echo "$OK package.json 存在"
  PASS=$((PASS + 1))
else
  echo "$FAIL package.json 不存在 — 你不在项目根目录？"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

if [ -d "node_modules" ]; then
  echo "$OK node_modules 存在"
  PASS=$((PASS + 1))
else
  echo "$WARN node_modules 不存在 — 跑 npm install"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

if [ -f ".env.local" ]; then
  echo "$OK .env.local 存在"
  PASS=$((PASS + 1))
else
  echo "$WARN .env.local 不存在 — Phase 0 Step 0 末尾创建"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

if [ -f ".env.example" ]; then
  echo "$OK .env.example 存在"
  PASS=$((PASS + 1))
else
  echo "$WARN .env.example 不存在 — 将在 Phase 0 创建"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

echo ""
echo "── 关键文档 ──"

for f in "AGENTS.md" "STATUS.md" "TASKS.md" "docs/CONVENTIONS.md" "docs/STACK.md" "playbook/phase-0-minimal.md"; do
  if [ -f "$f" ]; then
    echo "$OK $f"
    PASS=$((PASS + 1))
  else
    echo "$FAIL $f 缺失"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo "── Hooks ──"

for f in ".claude/settings.json" ".claude/hooks/check-file-size.js" ".claude/hooks/check-folder-size.js" ".claude/hooks/check-forbidden-imports.js"; do
  if [ -f "$f" ]; then
    echo "$OK $f"
    PASS=$((PASS + 1))
  else
    echo "$WARN $f 缺失（hook 不会触发）"
    WARN_COUNT=$((WARN_COUNT + 1))
  fi
done

echo ""
echo "================================================"
echo "  汇总：$PASS 通过 / $WARN_COUNT 警告 / $FAIL_COUNT 失败"
echo "================================================"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo ""
  echo "$FAIL 有失败项，需要先处理才能开始工作。"
  exit 1
fi

if [ "$WARN_COUNT" -gt 0 ]; then
  echo ""
  echo "$WARN 有警告项，但不影响开始工作。"
fi

echo ""
echo "$OK 环境就绪。"
exit 0
