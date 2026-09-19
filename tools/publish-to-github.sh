#!/usr/bin/env bash
# ============================================================
# 觅活 · 推送到 GitHub（在你自己的电脑终端里运行一次即可）
# 用法：bash tools/publish-to-github.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="https://github.com/xheng-cs/Mihuo-Campus.git"

if git remote -v | grep -q "Mihuo-Campus"; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

echo "🚀 正在推送 main 分支到 $REMOTE ..."
git push -u origin main

echo ""
echo "✅ 代码已推送。接下来只差开启 Pages（一次性设置）："
echo "   1. 打开 https://github.com/xheng-cs/Mihuo-Campus/settings/pages"
echo "   2. Build and deployment → Source 选「GitHub Actions」→ Save"
echo "   3. 回到仓库 Actions 页签，等「Deploy Pages」变成绿勾 ✅"
echo "   4. 手机打开最终作品链接：https://xheng-cs.github.io/Mihuo-Campus/"
