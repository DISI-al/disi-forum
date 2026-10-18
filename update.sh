#!/bin/bash
# ==============================================================
# DISI 论坛 — 服务器一键更新脚本
# 环境：Ubuntu + SQLite + Node 22 + Cloudflare Tunnel
# 用法：sudo bash update.sh
# ==============================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BLUE}==== $1 ====${NC}"; }

SRC_DIR="/opt/disi-forum-src"      # git 源码目录
DEPLOY_DIR="/opt/disi-forum"        # 运行目录
WWW_DIR="/var/www/disi-forum"       # nginx 静态目录
VENV="$DEPLOY_DIR/venv"

[ "$EUID" -ne 0 ] && { log_error "请用 sudo 运行"; exit 1; }

# --------------------------------------------------------------
# Step 1: 拉取最新代码
# --------------------------------------------------------------
log_step "Step 1/5: 拉取最新代码"
cd "$SRC_DIR"
git pull
log_info "代码已更新到 $(git rev-parse --short HEAD)"

# --------------------------------------------------------------
# Step 2: 同步后端代码（保留数据库和上传文件）
# --------------------------------------------------------------
log_step "Step 2/5: 同步后端代码（保留数据库和上传文件）"
rsync -a --exclude='venv' --exclude='*.db' --exclude='uploads' --exclude='__pycache__' \
      "$SRC_DIR/backend/" "$DEPLOY_DIR/backend/"
chown -R disi:disi "$DEPLOY_DIR/backend"
log_info "后端代码已同步"

# --------------------------------------------------------------
# Step 3: 安装后端依赖
# --------------------------------------------------------------
log_step "Step 3/5: 安装后端依赖"
"$VENV/bin/pip" install -q -r "$DEPLOY_DIR/backend/requirements.txt"
log_info "依赖已安装"

# --------------------------------------------------------------
# Step 4: 构建前端
# --------------------------------------------------------------
log_step "Step 4/5: 构建前端"
cd "$SRC_DIR/disi_vue_project"
rm -rf node_modules package-lock.json
npm install --silent
npm run build
rm -rf "${WWW_DIR:?}"/*
cp -r dist/. "$WWW_DIR/"
chown -R www-data:www-data "$WWW_DIR"
log_info "前端已构建并部署"

# --------------------------------------------------------------
# Step 5: 重启服务
# --------------------------------------------------------------
log_step "Step 5/5: 重启服务"
systemctl restart disi-forum
systemctl reload nginx
sleep 2
systemctl is-active --quiet disi-forum && log_info "disi-forum ✅ 运行中" || { log_error "disi-forum 启动失败"; journalctl -u disi-forum -n 20 --no-pager; exit 1; }
systemctl is-active --quiet nginx && log_info "nginx ✅ 运行中" || log_error "nginx 异常"

echo ""
echo "============================================================"
log_info "更新完成！访问 https://disi-al.com"
echo "============================================================"
