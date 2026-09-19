#!/usr/bin/env bash
# ============================================================
# 觅活 · 浏览器冒烟自测
# ------------------------------------------------------------
# 单元测试只能证明「纯逻辑」是对的，证明不了「页面里真的能用」。
# 本脚本把 tools/smoke-assert.js 注入 index.html 临时副本，用无头
# Chrome 真实点击按钮、填写表单、走完整流程：
#   阶段 1：渲染 → 搜索 → 报名 → 收藏 → 三步发布 → 举报
#   阶段 2：同一浏览器 profile 重新打开（模拟刷新），验证持久化
#
# 用法：bash tools/browser-smoke.sh
# 指定浏览器：CHROME=/path/to/chrome bash tools/browser-smoke.sh
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
HARNESS="$ROOT/.smoke.html"
PROFILE="$(mktemp -d -t mihuo-profile)"
MAX_WAIT=40   # 秒；拿到结果就提前退出（无头 Chrome 有时退出会卡住）

cleanup() {
  rm -f "$HARNESS"
  rm -rf "$PROFILE"
}
trap cleanup EXIT

if [ ! -x "$CHROME" ]; then
  echo "❌ 找不到 Chrome：$CHROME"
  echo "   可以用 CHROME=/path/to/chrome 指定其它 Chromium 内核浏览器"
  exit 2
fi

python3 - "$ROOT" "$HARNESS" <<'PY'
import io, os, sys

root, harness = sys.argv[1], sys.argv[2]
html = io.open(os.path.join(root, 'index.html'), encoding='utf-8').read()

catcher = ('<script>window.__errors=[];window.addEventListener("error",'
           'function(e){window.__errors.push(String(e.message));});</script>')
html = html.replace('<head>', '<head>' + catcher, 1)

assertion = io.open(os.path.join(root, 'tools', 'smoke-assert.js'), encoding='utf-8').read()
html = html.replace('</body>', '<script>' + assertion + '</script></body>', 1)

io.open(harness, 'w', encoding='utf-8').write(html)
PY

if [ ! -f "$HARNESS" ]; then
  echo "❌ 注入断言脚本失败"
  exit 1
fi

run_stage() {
  local stage="$1"
  local dom_log
  dom_log="$(mktemp -t mihuo-dom)"

  "$CHROME" \
    --headless=new --disable-gpu --no-sandbox --no-first-run \
    --disable-background-networking --disable-component-update --disable-sync \
    --disable-default-apps --disable-extensions \
    --user-data-dir="$PROFILE" --virtual-time-budget=20000 \
    --dump-dom "file://$HARNESS" > "$dom_log" 2>/dev/null &
  local pid=$!

  local line=""
  for _ in $(seq 1 "$MAX_WAIT"); do
    if grep -q 'SMOKE-RESULT' "$dom_log" 2>/dev/null; then
      line="$(sed -n '/<pre id="smoke-report">/,/<\/pre>/p' "$dom_log" | sed 's/<[^>]*>//g' | sed 's/&quot;/"/g' | head -40)"
      break
    fi
    sleep 1
  done

  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  rm -f "$dom_log"

  if [ -z "$line" ]; then
    echo "❌ 阶段 ${stage} 失败：${MAX_WAIT}s 内没拿到结果（页面可能没加载，或 JS 抛错）"
    return 1
  fi
  echo "$line" | sed 's/\\n/\n  /g'
  echo "$line" | grep -q "SMOKE-RESULT: stage${stage} PASS" || return 1
  return 0
}

echo "🧪 阶段 1：渲染 / 搜索 / 报名 / 收藏 / 发布 / 举报…"
S1="$(run_stage 1)" || { echo "$S1"; exit 1; }
echo "$S1"

echo ""
echo "🧪 阶段 2：同一 profile 重新打开（模拟刷新）验证持久化…"
S2="$(run_stage 2)" || { echo "$S2"; exit 1; }
echo "$S2"

echo ""
echo "✅ 浏览器冒烟测试全部通过（含刷新持久化）"
