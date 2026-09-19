#!/usr/bin/env bash
# ============================================================
# 觅活 · 推送到 GitHub（在你自己的电脑终端里运行一次即可）
# 用法：bash tools/publish-to-github.sh
#
# 说明：如果仓库里已经有「网页上传」产生的提交（Add files via upload），
# 那些提交会把目录结构拍平（css/ js/ 变成根目录下的散文件），
# 本脚本会提示并用本地完整开发历史覆盖它们。
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${REMOTE:-https://github.com/xheng-cs/Mihuo-Campus.git}"

if git remote -v | grep -q "Mihuo-Campus"; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

echo "🔍 检查远端状态 …"
if git fetch origin main 2>/dev/null; then
  AHEAD=$(git rev-list --count origin/main..main)
  BEHIND=$(git rev-list --count main..origin/main)
  echo "   本地领先远端 $AHEAD 个提交；远端有 $BEHIND 个本地没有的提交"

  if [ "$BEHIND" != "0" ]; then
    echo ""
    echo "⚠️  远端 main 与本地历史不一致（远端有 $BEHIND 个本地没有的提交）。"
    echo "    常见原因：之前用过网页端「Upload files」（会把目录结构拍平，"
    echo "    css/style.css、js/app.js 变成根目录散文件，index.html 找不到样式与脚本），"
    echo "    或曾通过 GitHub API 推送（内容相同但提交 SHA 不同）。"
    echo "    本脚本将用本地这份完整开发历史（$(git rev-list --count main) 次提交，含结构正确的源码）覆盖远端。"
    echo ""
    read -r -p "    确认覆盖远端 main？输入 yes 继续: " ans
    if [ "$ans" != "yes" ]; then
      echo "已取消，未做任何修改。"
      exit 1
    fi
    git push -u origin main --force-with-lease
  else
    git push -u origin main
  fi
else
  echo "   远端还没有 main 分支，直接推送。"
  git push -u origin main
fi

echo ""
echo "✅ 代码已推送（目录结构：index.html / css/ / js/ / test/ / tools/ / .github/）。"
echo ""
echo "📌 Pages 说明：仓库已配置为「Deploy from a branch（main / 根目录）」发布，"
echo "   本次 push 后 GitHub 会自动重新发布，约 1 分钟后生效，无需额外操作。"
echo "   若需检查：https://github.com/xheng-cs/Mihuo-Campus/settings/pages"
echo "   在线作品：https://xheng-cs.github.io/Mihuo-Campus/"
