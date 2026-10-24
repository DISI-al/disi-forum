#!/usr/bin/env bash
# ==============================================================
# DISI 论坛 — 服务器更新脚本
# 环境：Ubuntu / Debian + SQLite + systemd + Nginx
# 用法：sudo bash update.sh
#
# 流程：拉代码 → 同步后端 → 装依赖 → 构建前端 → 发布静态文件
#       → 重启后端 → 校验 Nginx → 健康检查
#
# 可用环境变量覆盖：
#   SRC_DIR=/opt/disi-forum-src   （git 源码目录）
#   DEPLOY_DIR=/opt/disi-forum    （后端运行目录）
#   WWW_DIR=/var/www/disi-forum   （前端静态目录）
#   SERVICE=disi-forum  APP_USER=disi  PORT=8000  BRANCH=main  NGINX_USER=www-data
# ==============================================================
set -euo pipefail

SRC_DIR="${SRC_DIR:-/opt/disi-forum-src}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/disi-forum}"
WWW_DIR="${WWW_DIR:-/var/www/disi-forum}"
SERVICE="${SERVICE:-disi-forum}"
APP_USER="${APP_USER:-disi}"
PORT="${PORT:-8000}"
BRANCH="${BRANCH:-main}"
NGINX_USER="${NGINX_USER:-www-data}"
VENV="${DEPLOY_DIR}/venv"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BLUE}==== $1 ====${NC}"; }
die() { log_error "$1"; exit 1; }

# --------------------------------------------------------------
# Step 0: 环境检查
# --------------------------------------------------------------
log_step "Step 0/7: 环境检查"

[ "$(id -u)" -eq 0 ] || die "请用 sudo 运行: sudo bash $0"
command -v git >/dev/null 2>&1 || die "缺少 git"
command -v npm >/dev/null 2>&1 || die "缺少 npm / Node.js（建议 Node 20+）"
[ -d "${SRC_DIR}/.git" ] || die "源码目录不是 git 仓库: ${SRC_DIR}"
[ -d "${DEPLOY_DIR}/backend" ] || die "未找到后端运行目录: ${DEPLOY_DIR}/backend"
[ -x "${VENV}/bin/pip" ] || die "虚拟环境不存在: ${VENV}（请先用 deploy_oneclick.sh 完成首次部署）"

log_info "源码目录 ${SRC_DIR}"
log_info "运行目录 ${DEPLOY_DIR}"
log_info "静态目录 ${WWW_DIR}"

# --------------------------------------------------------------
# Step 1: 拉取最新代码
# --------------------------------------------------------------
log_step "Step 1/7: 拉取最新代码"

cd "${SRC_DIR}"
OLD_COMMIT="$(git rev-parse --short HEAD)"
git fetch --prune origin || die "git fetch 失败，请检查网络或仓库权限"
git checkout "${BRANCH}" >/dev/null 2>&1 || die "切换分支失败: ${BRANCH}"
git pull --ff-only origin "${BRANCH}" || die "git pull 失败（本地可能有未提交改动，先处理再重试）"

NEW_COMMIT="$(git rev-parse --short HEAD)"
if [ "${OLD_COMMIT}" = "${NEW_COMMIT}" ]; then
    log_warn "代码已是最新（${NEW_COMMIT}），仍会重新构建前端"
else
    log_info "代码 ${OLD_COMMIT} → ${NEW_COMMIT}"
fi
log_info "最新提交：$(git log -1 --pretty=%s)"

# --------------------------------------------------------------
# Step 2: 同步后端代码（保留数据库和上传文件）
# --------------------------------------------------------------
log_step "Step 2/7: 同步后端代码（保留数据库与上传文件）"

if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
        --exclude='venv' \
        --exclude='*.db' --exclude='*.db-*' \
        --exclude='uploads' \
        --exclude='__pycache__' \
        "${SRC_DIR}/backend/" "${DEPLOY_DIR}/backend/"
else
    log_warn "未安装 rsync，改用逐个复制（不会删除服务端多余文件）"
    for f in "${SRC_DIR}/backend/"*.py "${SRC_DIR}/backend/requirements.txt"; do
        [ -f "$f" ] && cp "$f" "${DEPLOY_DIR}/backend/"
    done
fi
mkdir -p "${DEPLOY_DIR}/backend/uploads"
chown -R "${APP_USER}:${APP_USER}" "${DEPLOY_DIR}/backend" 2>/dev/null || true
log_info "后端代码已同步"

# --------------------------------------------------------------
# Step 3: 安装后端依赖
# --------------------------------------------------------------
log_step "Step 3/7: 安装后端依赖"

"${VENV}/bin/pip" install -q --upgrade pip
"${VENV}/bin/pip" install -q -r "${DEPLOY_DIR}/backend/requirements.txt"
log_info "依赖已安装"

# --------------------------------------------------------------
# Step 4: 构建前端
# --------------------------------------------------------------
log_step "Step 4/7: 构建前端"

cd "${SRC_DIR}/disi_vue_project"
if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
else
    npm install --no-audit --no-fund
fi
npm run build

[ -f dist/index.html ] || die "构建产物缺失：dist/index.html"
log_info "构建完成（dist/index.html 已生成）"

# --------------------------------------------------------------
# Step 5: 发布静态文件（保留上一版用于回滚）
# --------------------------------------------------------------
log_step "Step 5/7: 发布静态文件"

mkdir -p "${WWW_DIR}"
if [ -n "$(ls -A "${WWW_DIR}" 2>/dev/null || true)" ]; then
    rm -rf "${WWW_DIR}.bak"
    cp -a "${WWW_DIR}" "${WWW_DIR}.bak"
    log_info "上一版已备份到 ${WWW_DIR}.bak"
fi

find "${WWW_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a dist/. "${WWW_DIR}/"
chown -R "${NGINX_USER}:${NGINX_USER}" "${WWW_DIR}" 2>/dev/null || true
log_info "静态文件已发布"

# --------------------------------------------------------------
# Step 6: 重启后端 + 校验 Nginx
# --------------------------------------------------------------
log_step "Step 6/7: 重启服务"

systemctl restart "${SERVICE}"
sleep 2
if ! systemctl is-active --quiet "${SERVICE}"; then
    log_error "后端启动失败，最近日志："
    journalctl -u "${SERVICE}" -n 30 --no-pager || true
    die "更新中止（静态文件已更新，可回滚：rm -rf ${WWW_DIR} && mv ${WWW_DIR}.bak ${WWW_DIR}）"
fi
log_info "${SERVICE} ✅ 运行中"

if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
    log_info "nginx ✅ 已重载"
else
    nginx -t || true
    die "nginx 配置有误，未重载；请先修复配置"
fi

# --------------------------------------------------------------
# Step 7: 健康检查
# --------------------------------------------------------------
log_step "Step 7/7: 健康检查"

BK_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/docs" || true)"
[ "${BK_CODE}" = "200" ] && log_info "后端 /docs → 200" || log_warn "后端 /docs → ${BK_CODE}，查日志: journalctl -u ${SERVICE} -n 50"

WEB_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1/" || true)"
[ "${WEB_CODE}" = "200" ] && log_info "首页 / → 200" || log_warn "首页 / → ${WEB_CODE}"

echo ""
echo "============================================================"
log_info "更新完成：${NEW_COMMIT}"
log_info "index.html 已设为 no-cache，刷新浏览器即可看到新版本"
echo "============================================================"
