#!/usr/bin/env bash
# 一键构建 + 发布两个前端（第四论坛 / INSIST）
# 用法：sudo bash deploy/build-and-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORUM_DIR="$ROOT/forum_app"
INSIST_DIR="$ROOT/insist_app"
FORUM_WEB="/var/www/forum"
INSIST_WEB="/var/www/insist"
BACKEND_DIR="$ROOT/backend"

blue()   { printf '\033[36m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

blue "[1/6] 检查构建环境"
command -v node >/dev/null || { echo "缺少 node"; exit 1; }
NODE_MAJOR="$(node -v | sed 's/v//' | cut -d. -f1)"
[[ "$NODE_MAJOR" -ge 18 ]] || { echo "node 版本过低：$(node -v)"; exit 1; }

for dir in "$FORUM_DIR" "$INSIST_DIR"; do
  if [[ ! -d "$dir/node_modules" ]]; then
    blue "安装依赖：$dir"
    (cd "$dir" && npm ci --no-audit --no-fund)
  fi
done

blue "[2/6] 构建 第四论坛"
(cd "$FORUM_DIR" && npm run build)

blue "[3/6] 构建 INSIST"
(cd "$INSIST_DIR" && npm run build)

blue "[4/6] 发布静态文件"
sudo mkdir -p "$FORUM_WEB" "$INSIST_WEB"
sudo rsync -a --delete --exclude 'index.html' "$FORUM_DIR/dist/" "$FORUM_WEB/"
sudo rsync -a --delete --exclude 'index.html' "$INSIST_DIR/dist/" "$INSIST_WEB/"
# index.html 单独覆盖，避免被 CDN/浏览器缓存旧版本
sudo cp -f "$FORUM_DIR/dist/index.html" "$FORUM_WEB/index.html"
sudo cp -f "$INSIST_DIR/dist/index.html" "$INSIST_WEB/index.html"

blue "[5/6] 写入 Nginx 配置并校验"
sudo cp -f "$ROOT/deploy/nginx-forum.conf" /etc/nginx/conf.d/disi-forum.conf
sudo cp -f "$ROOT/deploy/nginx-insist.conf" /etc/nginx/conf.d/insist.conf
sudo nginx -t
sudo systemctl reload nginx

blue "[6/6] 重启后端 + 健康检查"
if systemctl is-active --quiet disi-forum; then
  sudo systemctl restart disi-forum
else
  yellow "未找到 disi-forum.service，跳过后端重启（如用 uvicorn 手动启动请自行重启）"
fi

sleep 2
for url in "http://127.0.0.1/" "http://127.0.0.1/api/posts/posts"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
  echo "  $url -> $code"
done

if [[ -n "${PUBLIC_CHECK:-}" ]]; then
  for host in "https://disi-al.com" "https://insist.disi-al.com"; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$host" || true)"
    echo "  $host -> $code"
  done
fi

green "完成：$FORUM_WEB（论坛） / $INSIST_WEB（INSIST）"
