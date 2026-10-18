#!/usr/bin/env bash
# ==============================================================
# DISI 论坛 — 通用一键部署脚本
# 适用: Ubuntu / Debian / CentOS / RHEL / Rocky / Alma
# 用法: sudo bash deploy_oneclick.sh
#
# 特点:
#   - 自动识别包管理器 (apt / dnf / yum)
#   - 自动定位脚本所在目录作为项目根目录
#   - 默认使用 SQLite（免装数据库，启动自动建表+建管理员）
#   - 随机生成 JWT 密钥
#   - 不依赖 Cloudflare，直接 Nginx 对外
# ==============================================================
set -euo pipefail

# ── 颜色 ──────────────────────────────────────
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'
ok()   { echo -e "  ${G}[OK]${N} $1"; }
warn() { echo -e "  ${Y}[!!]${N} $1"; }
err()  { echo -e "  ${R}[XX]${N} $1"; }
step() { echo -e "\n${C}━━━ $1 ━━━${N}"; }

# ── root 检查 ──────────────────────────────────
[ "$(id -u)" -ne 0 ] && { err "请用 sudo 运行: sudo bash $0"; exit 1; }

# ── 自动定位项目根目录（脚本所在目录）────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"

# 校验目录结构
[ -d "${PROJECT_DIR}/backend" ] || { err "未找到 backend 目录，请在项目根目录运行本脚本"; exit 1; }
[ -d "${PROJECT_DIR}/disi_vue_project" ] || { err "未找到 disi_vue_project 目录"; exit 1; }

# ── 可调参数 ──────────────────────────────────
DEPLOY_DIR="/opt/disi-forum"          # 后端部署目录
WWW_DIR="/var/www/disi-forum"         # 前端静态文件目录
APP_USER="disi"                       # 运行后端的系统用户
BACKEND_PORT="8000"                   # 后端监听端口（仅本机）
JWT_KEY="$(openssl rand -hex 32)"     # 随机 JWT 密钥

# 数据库：默认 SQLite（零配置）
# 如需 MySQL，取消下面注释并填写（同时需装 mariadb-server）
# DB_TYPE="mysql"
# DB_NAME="disi_forum"; DB_USER="disi"; DB_PASS="改成你的密码"

cat <<BANNER

  ╔══════════════════════════════════════════╗
  ║        DISI 论坛 — 一键部署              ║
  ║   项目目录: ${PROJECT_DIR}
  ╚══════════════════════════════════════════╝

BANNER

# ── 识别包管理器 ──────────────────────────────
if command -v apt-get &>/dev/null; then
    PKG="apt";  INSTALL="apt-get install -y";  UPDATE="apt-get update -y"
    NGINX_USER="www-data"
elif command -v dnf &>/dev/null; then
    PKG="dnf";  INSTALL="dnf install -y";      UPDATE="dnf makecache --refresh || true"
    NGINX_USER="nginx"
elif command -v yum &>/dev/null; then
    PKG="yum";  INSTALL="yum install -y";      UPDATE="yum makecache || true"
    NGINX_USER="nginx"
else
    err "未识别的包管理器（需要 apt/dnf/yum）"; exit 1
fi
ok "系统包管理器: ${PKG}"

# ============================================================
#  1. 系统依赖
# ============================================================
step "1/7 系统依赖"
$UPDATE >/dev/null 2>&1 || true

if [ "$PKG" = "apt" ]; then
    $INSTALL python3 python3-pip python3-venv python3-dev build-essential \
             nginx curl openssl libffi-dev libssl-dev >/dev/null 2>&1 || \
    $INSTALL python3 python3-pip python3-venv python3-dev build-essential \
             nginx curl openssl libffi-dev >/dev/null 2>&1
else
    $INSTALL python3 python3-pip python3-devel gcc make \
             nginx curl openssl libffi-devel openssl-devel >/dev/null 2>&1 || true
fi
ok "基础依赖完成"

# ============================================================
#  2. 后端部署
# ============================================================
step "2/7 FastAPI 后端"

mkdir -p "${DEPLOY_DIR}/backend/uploads"
# 复制后端源码（排除本地数据库和缓存，避免覆盖线上数据）
for f in main.py models.py database.py auth.py schemas.py requirements.txt; do
    [ -f "${PROJECT_DIR}/backend/$f" ] && cp "${PROJECT_DIR}/backend/$f" "${DEPLOY_DIR}/backend/"
done
# 复制其他可能的 .py（如 add_user.py）
for f in "${PROJECT_DIR}/backend/"*.py; do
    [ -f "$f" ] && cp "$f" "${DEPLOY_DIR}/backend/" 2>/dev/null || true
done

# 虚拟环境
python3 -m venv "${DEPLOY_DIR}/venv"
source "${DEPLOY_DIR}/venv/bin/activate"
pip install --upgrade pip -q
pip install -r "${DEPLOY_DIR}/backend/requirements.txt" -q
deactivate

# 系统用户
id "${APP_USER}" &>/dev/null || useradd -r -s /sbin/nologin "${APP_USER}" 2>/dev/null || \
    adduser --system --no-create-home --shell /usr/sbin/nologin "${APP_USER}" 2>/dev/null || true
chown -R "${APP_USER}:${APP_USER}" "${DEPLOY_DIR}"
chmod 755 "${DEPLOY_DIR}/backend/uploads"
ok "后端依赖安装完成"

# ============================================================
#  3. 前端构建
# ============================================================
step "3/7 Vue 前端构建"

if ! command -v node &>/dev/null; then
    warn "未检测到 Node.js，尝试安装 Node 22..."
    if [ "$PKG" = "apt" ]; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 || true
        $INSTALL nodejs >/dev/null 2>&1 || true
    else
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 || true
        $INSTALL nodejs >/dev/null 2>&1 || true
    fi
fi

if command -v node &>/dev/null; then
    ok "Node 版本: $(node -v)"
    cd "${PROJECT_DIR}/disi_vue_project"
    # 清理从 Windows 复制过来的 node_modules（权限位丢失会导致 vite Permission denied）
    rm -rf node_modules package-lock.json 2>/dev/null || true
    # 安装依赖并构建
    npm install --no-audit --no-fund 2>&1 | tail -2
    npm run build 2>&1 | tail -3
    mkdir -p "${WWW_DIR}"
    rm -rf "${WWW_DIR:?}"/*
    cp -r dist/* "${WWW_DIR}/"
    chown -R "${NGINX_USER}:${NGINX_USER}" "${WWW_DIR}" 2>/dev/null || true
    cd /
    ok "前端构建完成 -> ${WWW_DIR}"
else
    err "Node.js 安装失败，请手动安装 Node 22+ 后重跑，或直接使用已打包的 dist/"
    # 兜底：如果本地已有 dist，直接复制
    if [ -d "${PROJECT_DIR}/disi_vue_project/dist" ]; then
        mkdir -p "${WWW_DIR}"; rm -rf "${WWW_DIR:?}"/*
        cp -r "${PROJECT_DIR}/disi_vue_project/dist/"* "${WWW_DIR}/"
        chown -R "${NGINX_USER}:${NGINX_USER}" "${WWW_DIR}" 2>/dev/null || true
        warn "已使用现有 dist/ 目录部署前端"
    fi
fi

# ============================================================
#  4. Nginx 配置
# ============================================================
step "4/7 Nginx 配置"

if [ "$PKG" = "apt" ]; then
    NGINX_CONF="/etc/nginx/sites-available/disi-forum"
    NGINX_LINK="/etc/nginx/sites-enabled/disi-forum"
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    # 移除默认站点避免冲突
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
else
    NGINX_CONF="/etc/nginx/conf.d/disi-forum.conf"
    NGINX_LINK=""
    mkdir -p /etc/nginx/conf.d
fi

cat > "${NGINX_CONF}" <<NGINX
server {
    listen 80;
    server_name _;
    charset utf-8;
    root ${WWW_DIR};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 500M;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        client_max_body_size 500M;
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
NGINX

[ -n "${NGINX_LINK}" ] && ln -sf "${NGINX_CONF}" "${NGINX_LINK}"

# SELinux（仅 RHEL 系有）
if command -v setsebool &>/dev/null; then
    setsebool -P httpd_can_network_connect 1 2>/dev/null || true
    command -v restorecon &>/dev/null && restorecon -R "${WWW_DIR}" 2>/dev/null || true
fi

if nginx -t 2>&1; then
    systemctl enable nginx >/dev/null 2>&1 || true
    systemctl restart nginx
    ok "Nginx 配置完成并重启"
else
    err "Nginx 配置测试失败，请检查 ${NGINX_CONF}"
fi

# ============================================================
#  5. systemd 守护
# ============================================================
step "5/7 systemd 进程守护"

# 默认 SQLite 数据库路径
DATABASE_URL="sqlite:////${DEPLOY_DIR#/}/backend/disi_forum.db"

cat > /etc/systemd/system/disi-forum.service <<SYSTEMD
[Unit]
Description=DISI Forum Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${DEPLOY_DIR}/backend
Environment="DATABASE_URL=${DATABASE_URL}"
Environment="JWT_SECRET_KEY=${JWT_KEY}"
ExecStart=${DEPLOY_DIR}/venv/bin/uvicorn main:app --host 127.0.0.1 --port ${BACKEND_PORT} --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable disi-forum >/dev/null 2>&1 || true
systemctl restart disi-forum
sleep 3
ok "systemd 服务已启动"

# ============================================================
#  6. 防火墙
# ============================================================
step "6/7 防火墙"

if command -v firewall-cmd &>/dev/null; then
    firewall-cmd --permanent --add-service=http  >/dev/null 2>&1 || true
    firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
    ok "firewalld 已放行 80/443"
elif command -v ufw &>/dev/null; then
    ufw allow 80/tcp  >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ok "ufw 已放行 80/443"
else
    warn "未检测到防火墙工具，跳过"
fi

# ============================================================
#  7. 状态检查
# ============================================================
step "7/7 服务状态"

check_svc() {
    systemctl is-active "$1" &>/dev/null && \
        echo -e "  ${G}●${N} $2 运行中" || \
        echo -e "  ${R}○${N} $2 异常 — journalctl -u $1 -n 20"
}
check_svc disi-forum "后端 (disi-forum)"
check_svc nginx      "Nginx"

# 探测后端
sleep 1
if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${BACKEND_PORT}/docs" | grep -q "200\|30"; then
    ok "后端接口可访问 (http://127.0.0.1:${BACKEND_PORT}/docs)"
else
    warn "后端接口暂未响应，查看日志: journalctl -u disi-forum -n 30 --no-pager"
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$IP" ] && IP="服务器IP"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║            部 署 完 成                    ║"
echo "  ╠══════════════════════════════════════════╣"
echo "  ║  访问:   http://${IP}"
echo "  ║  账号:   disi"
echo "  ║  密码:   disi0001"
echo "  ║  数据库: SQLite (${DEPLOY_DIR}/backend/disi_forum.db)"
echo "  ║  日志:   journalctl -u disi-forum -f"
echo "  ╚══════════════════════════════════════════╝"
echo ""
