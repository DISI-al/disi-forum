#!/usr/bin/env bash
# ==============================================================
# DISI 双站点（DISI_FORUM + DISI_INSIST）服务器更新脚本
# 环境：Ubuntu / Debian + SQLite + systemd + Nginx + Cloudflare Tunnel
# 用法：sudo bash update.sh
#
# 流程：拉代码 → 同步后端 → 装依赖 → 构建两个前端 → 发布静态文件
#       → 写 Nginx 双站点配置 → 重启后端 → 健康检查
#
# 可用环境变量覆盖：
#   SRC_DIR=/opt/disi-forum-src
#   DEPLOY_DIR=/opt/disi-forum
#   WWW_FORUM=/var/www/forum      （disi-al.com）
#   WWW_INSIST=/var/www/insist    （insist.disi-al.com）
#   SERVICE=disi-forum  APP_USER=disi  PORT=8000  BRANCH=main  NGINX_USER=www-data
# ==============================================================
set -euo pipefail

SRC_DIR="${SRC_DIR:-/opt/disi-forum-src}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/disi-forum}"
WWW_FORUM="${WWW_FORUM:-/var/www/forum}"
WWW_INSIST="${WWW_INSIST:-/var/www/insist}"
WWW_HOME="${WWW_HOME:-/var/www/home}"
DOWNLOAD_DIR="${DOWNLOAD_DIR:-/var/www/download}"
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
log_step "Step 0/8: 环境检查"
[ "$(id -u)" -eq 0 ] || die "请用 sudo 运行: sudo bash $0"
command -v git >/dev/null 2>&1 || die "缺少 git"
command -v npm >/dev/null 2>&1 || die "缺少 npm / Node.js（建议 Node 20+）"
[ -d "${SRC_DIR}/.git" ] || die "源码目录不是 git 仓库: ${SRC_DIR}"
[ -d "${DEPLOY_DIR}/backend" ] || die "未找到后端运行目录: ${DEPLOY_DIR}/backend"
[ -x "${VENV}/bin/pip" ] || die "虚拟环境不存在: ${VENV}（请先用 deploy_oneclick.sh 完成首次部署）"

log_info "源码 ${SRC_DIR} / 后端 ${DEPLOY_DIR}"
log_info "门户 ${WWW_HOME} / 论坛 ${WWW_FORUM} / INSIST ${WWW_INSIST} / 下载 ${DOWNLOAD_DIR}"

# --------------------------------------------------------------
log_step "Step 1/8: 拉取最新代码"
cd "${SRC_DIR}"
OLD_COMMIT="$(git rev-parse --short HEAD)"
git fetch --prune origin || die "git fetch 失败"
git checkout "${BRANCH}" >/dev/null 2>&1 || die "切换分支失败: ${BRANCH}"
git pull --ff-only origin "${BRANCH}" || die "git pull 失败（本地可能有未提交改动）"
NEW_COMMIT="$(git rev-parse --short HEAD)"
if [ "${OLD_COMMIT}" = "${NEW_COMMIT}" ]; then
    log_warn "代码已是最新（${NEW_COMMIT}），仍会重新构建"
else
    log_info "代码 ${OLD_COMMIT} → ${NEW_COMMIT}"
fi
log_info "最新提交：$(git log -1 --pretty=%s)"

# --------------------------------------------------------------
log_step "Step 2/8: 同步后端代码（保留数据库与上传文件）"
if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
        --exclude='venv' --exclude='*.db' --exclude='*.db-*' \
        --exclude='uploads' --exclude='__pycache__' \
        "${SRC_DIR}/backend/" "${DEPLOY_DIR}/backend/"
else
    log_warn "未安装 rsync，改用逐个复制"
    for f in "${SRC_DIR}/backend/"*.py "${SRC_DIR}/backend/requirements.txt"; do
        [ -f "$f" ] && cp "$f" "${DEPLOY_DIR}/backend/"
    done
fi
mkdir -p "${DEPLOY_DIR}/backend/uploads"
chown -R "${APP_USER}:${APP_USER}" "${DEPLOY_DIR}/backend" 2>/dev/null || true
log_info "后端代码已同步"

# --------------------------------------------------------------
log_step "Step 3/8: 安装后端依赖"
"${VENV}/bin/pip" install -q --upgrade pip
"${VENV}/bin/pip" install -q -r "${DEPLOY_DIR}/backend/requirements.txt"
log_info "依赖已安装"

# --------------------------------------------------------------
build_app() {
    local dir="$1" name="$2"
    log_info "构建 ${name} …"
    cd "${dir}"
    if [ -f package-lock.json ]; then
        npm ci --no-audit --no-fund
    else
        npm install --no-audit --no-fund
    fi
    npm run build
    [ -f dist/index.html ] || die "${name} 构建产物缺失：dist/index.html"
    log_info "${name} 构建完成"
}

publish_app() {
    local src="$1" dst="$2" name="$3"
    mkdir -p "${dst}"
    if [ -n "$(ls -A "${dst}" 2>/dev/null || true)" ]; then
        rm -rf "${dst}.bak"
        cp -a "${dst}" "${dst}.bak"
    fi
    find "${dst}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -a "${src}/." "${dst}/"
    chown -R "${NGINX_USER}:${NGINX_USER}" "${dst}" 2>/dev/null || true
    log_info "${name} 已发布到 ${dst}"
}

log_step "Step 4/8: 构建两个前端"
build_app "${SRC_DIR}/forum_app" "DISI_FORUM"
build_app "${SRC_DIR}/insist_app" "DISI_INSIST"

# --------------------------------------------------------------
log_step "Step 5/8: 发布静态文件"
publish_app "${SRC_DIR}/forum_app/dist" "${WWW_FORUM}" "DISI_FORUM"
publish_app "${SRC_DIR}/insist_app/dist" "${WWW_INSIST}" "DISI_INSIST"

# 门户页（静态）
publish_app "${SRC_DIR}/site" "${WWW_HOME}" "门户"
cp -f "${SRC_DIR}/assets/icon.png" "${WWW_HOME}/icon.png" 2>/dev/null || true
cp -f "${SRC_DIR}/assets/favicon.ico" "${WWW_HOME}/favicon.ico" 2>/dev/null || true

# 客户端安装包
mkdir -p "${DOWNLOAD_DIR}"
cp -f "${SRC_DIR}/desktop/forum/release/DISI_FORUM Setup.exe" "${DOWNLOAD_DIR}/DISI_FORUM-Setup.exe" 2>/dev/null || true
cp -f "${SRC_DIR}/desktop/forum/release/DISI-Forum-win-x64.zip" "${DOWNLOAD_DIR}/DISI_FORUM-portable.zip" 2>/dev/null || true
cp -f "${SRC_DIR}/desktop/insist/release/DISI_INSIST Setup.exe" "${DOWNLOAD_DIR}/DISI_INSIST-Setup.exe" 2>/dev/null || true
cp -f "${SRC_DIR}/desktop/insist/release/INSIST-win-x64.zip" "${DOWNLOAD_DIR}/DISI_INSIST-portable.zip" 2>/dev/null || true
chown -R "${NGINX_USER}:${NGINX_USER}" "${DOWNLOAD_DIR}" 2>/dev/null || true
log_info "安装包已发布到 ${DOWNLOAD_DIR}"

# --------------------------------------------------------------
log_step "Step 6/8: 写入 Nginx 双站点配置"
CONF_DIR="/etc/nginx/conf.d"
mkdir -p "${CONF_DIR}"
cp -a "${CONF_DIR}/disi-forum.conf" "${CONF_DIR}/disi-forum.conf.bak" 2>/dev/null || true
cp -f "${SRC_DIR}/deploy/nginx-forum.conf"  "${CONF_DIR}/disi-forum.conf"
cp -f "${SRC_DIR}/deploy/nginx-insist.conf" "${CONF_DIR}/insist.conf"
cp -f "${SRC_DIR}/deploy/nginx-home.conf"   "${CONF_DIR}/disi-home.conf"
log_info "配置已写入：disi-home.conf / disi-forum.conf / insist.conf"

nginx -t || die "nginx 配置有误，未重载"
systemctl reload nginx
log_info "nginx ✅ 已重载"

# --------------------------------------------------------------
log_step "Step 7/8: 重启后端"
systemctl restart "${SERVICE}"
sleep 2
if ! systemctl is-active --quiet "${SERVICE}"; then
    log_error "后端启动失败，最近日志："
    journalctl -u "${SERVICE}" -n 30 --no-pager || true
    die "更新中止（静态文件已更新，可回滚 .bak 目录）"
fi
log_info "${SERVICE} ✅ 运行中"

# --------------------------------------------------------------
log_step "Step 8/8: 健康检查"
for url in "http://127.0.0.1/" "http://127.0.0.1/api/posts/posts"; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
    echo "  ${url} -> ${code}"
done

echo
log_info "完成。请浏览器验证："
echo "   门户   https://disi-al.com"
echo "   论坛   https://forum.disi-al.com"
echo "   INSIST https://insist.disi-al.com"
echo "   下载   https://disi-al.com/download/DISI_FORUM-Setup.exe"
