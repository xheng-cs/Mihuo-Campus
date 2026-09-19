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
    echo "⚠️  远端存在网页端上传（Add files via upload）产生的提交。"
    echo "    这些提交把目录结构拍平了：css/style.css、js/app.js 等变成了根目录下的"
    echo "    散文件，index.html 里写的 css/ 与 js/ 路径全部失效（页面会白屏、无样式）；"
    echo "    .github/workflows 也没上传成功，所以 Pages 永远不会自动部署。"
    echo "    本脚本将用本地这份完整开发历史覆盖远端（12 次有意义的提交）。"
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
echo "📌 还差一步：开启 Pages（一次性设置，建议现在就做）"
echo "   1. 打开 https://github.com/xheng-cs/Mihuo-Campus/settings/pages"
echo "   2. Build and deployment → Source 选「GitHub Actions」→ Save"
echo "   3. 回到仓库 Actions 页签，等「Deploy Pages」变绿勾 ✅"
echo "      （若这次推送触发的流水线在开启 Pages 之前就已经失败，点 Re-run all jobs 重跑）"
echo "   4. 手机打开最终作品链接：https://xheng-cs.github.io/Mihuo-Campus/"
