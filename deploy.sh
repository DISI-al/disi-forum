#!/bin/bash
# ==============================================================
# DISI 论坛 — 完整部署脚本 (disi-al.com)
# 适用: CentOS Stream 10
# 用法: sudo bash deploy.sh
# ==============================================================

clear

# ── 配置 ──────────────────────────────────────
ROOT_PASS="DisiMysql2024"
DB_NAME="disi_forum"
DB_USER="disi"
DB_PASS="DisiForum2024"
JWT_KEY=$(openssl rand -hex 32)

PROJECT_DIR="/home/disi/final_demo"
DEPLOY_DIR="/opt/disi-forum"
WWW_DIR="/var/www/disi-forum"
DOMAIN="disi-al.com"
TUNNEL_NAME="disi-forum"

G='\033[0;32m'; Y='\033[1;33m'; C='\033[0;36m'; N='\033[0m'
ok()  { echo -e "  ${G}[OK]${N} $1"; }
warn(){ echo -e "  ${Y}[!!]${N} $1"; }
step(){ echo -e "\n${C}━━━ $1 ━━━${N}"; }

# ── root 检查 ──────────────────────────────────
[ "$(id -u)" -ne 0 ] && { echo "请用 sudo 运行"; exit 1; }

cat <<BANNER

  ╔══════════════════════════════════════╗
  ║       DISI 论坛 — 一键部署         ║
  ║       域名: ${DOMAIN}        ║
  ╚══════════════════════════════════════╝

BANNER

# ============================================================
#  1. 系统包
# ============================================================
step "1/8 系统依赖"

dnf makecache --refresh 2>/dev/null || true
dnf install -y epel-release 2>/dev/null || true

# nginx 元包（不是 nginx-core）
dnf install -y nginx git curl wget tar gzip openssl firewalld 2>/dev/null || true

systemctl enable --now firewalld 2>/dev/null || true
ok "系统依赖完成"

# ============================================================
#  2. MariaDB
# ============================================================
step "2/8 MariaDB 数据库"

# 清理第三方仓库（GPG 可能过期）
rm -f /etc/yum.repos.d/mysql*.repo /etc/yum.repos.d/MariaDB*.repo 2>/dev/null

if ! command -v mysql &>/dev/null; then
    dnf install -y mariadb-server mariadb 2>/dev/null || \
    dnf install -y --nogpgcheck mariadb-server mariadb
fi

systemctl enable --now mariadb 2>/dev/null || true
sleep 1

# root 密码
if mysql -u root -e "SELECT 1" &>/dev/null 2>&1; then
    mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${ROOT_PASS}'; FLUSH PRIVILEGES;"
fi

# 库和用户
mysql -u root -p"${ROOT_PASS}" <<SQL 2>/dev/null
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
ok "MariaDB 就绪"

# ============================================================
#  3. FastAPI 后端
# ============================================================
step "3/8 FastAPI 后端"

dnf install -y python3 python3-pip python3-devel gcc openssl-devel libffi-devel 2>/dev/null || true

mkdir -p "${DEPLOY_DIR}/backend/uploads"
cp "${PROJECT_DIR}/backend/"*.py "${DEPLOY_DIR}/backend/"
cp "${PROJECT_DIR}/backend/requirements.txt" "${DEPLOY_DIR}/backend/"

python3 -m venv "${DEPLOY_DIR}/venv" 2>/dev/null || true
source "${DEPLOY_DIR}/venv/bin/activate"
pip install --upgrade pip -q 2>/dev/null
pip install -r "${DEPLOY_DIR}/backend/requirements.txt"
deactivate

id disi &>/dev/null || useradd -r -s /sbin/nologin disi
chown -R disi:disi "${DEPLOY_DIR}"
chmod 755 "${DEPLOY_DIR}/backend/uploads"
ok "后端就绪"

# ============================================================
#  4. Vue 前端
# ============================================================
step "4/8 Vue 前端构建"

if ! command -v node &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - 2>/dev/null || true
    dnf install -y nodejs 2>/dev/null
fi

cd "${PROJECT_DIR}/disi_vue_project"
rm -rf node_modules package-lock.json 2>/dev/null
npm install 2>/dev/null
chmod +x node_modules/.bin/* 2>/dev/null
npm run build

mkdir -p "${WWW_DIR}"
rm -rf "${WWW_DIR:?}"/*
cp -r dist/* "${WWW_DIR}/"
chown -R nginx:nginx "${WWW_DIR}" 2>/dev/null || true
cd /
ok "前端就绪 (${WWW_DIR})"

# ============================================================
#  5. Nginx
# ============================================================
step "5/8 Nginx 配置"

# 确保 conf.d 目录存在
mkdir -p /etc/nginx/conf.d

cat > /etc/nginx/conf.d/disi-forum.conf <<NGINX
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
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 500M;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8000;
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

# 清理 nginx.conf 中可能冲突的默认 server 块
if grep -q '^\s*server\s*{' /etc/nginx/nginx.conf 2>/dev/null; then
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak 2>/dev/null
    cat > /etc/nginx/nginx.conf <<'NCDEF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;
include /usr/share/nginx/modules/*.conf;
events { worker_connections 1024; }
http {
    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    types_hash_max_size 4096;
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    include /etc/nginx/conf.d/*.conf;
}
NCDEF
fi

# SELinux
setsebool -P httpd_can_network_connect 1 2>/dev/null || true
restorecon -R "${WWW_DIR}" 2>/dev/null || true

nginx -t 2>&1 && { systemctl enable --now nginx 2>/dev/null; systemctl restart nginx 2>/dev/null; }
ok "Nginx 就绪"

# ============================================================
#  6. systemd 守护
# ============================================================
step "6/8 systemd 进程守护"

cat > /etc/systemd/system/disi-forum.service <<SYSTEMD
[Unit]
Description=DISI Forum Backend (FastAPI)
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=disi
Group=disi
WorkingDirectory=${DEPLOY_DIR}/backend
Environment="DATABASE_URL=mysql+pymysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}"
Environment="JWT_SECRET_KEY=${JWT_KEY}"
ExecStart=${DEPLOY_DIR}/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable disi-forum
ok "systemd 就绪（开机自启 + 崩溃自动重启）"

# ============================================================
#  7. 防火墙
# ============================================================
step "7/8 防火墙"

firewall-cmd --permanent --add-service=http  2>/dev/null || true
firewall-cmd --permanent --add-service=https 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true
ok "防火墙就绪"

# ============================================================
#  8. Cloudflare Tunnel
# ============================================================
step "8/8 Cloudflare Tunnel"

CF="/usr/local/bin/cloudflared"

# 下载
if [ ! -f "${CF}" ]; then
    ARCH="amd64"
    [ "$(uname -m)" = "aarch64" ] && ARCH="arm64"
    curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}" -o "${CF}"
    chmod +x "${CF}"
fi
ok "cloudflared $(${CF} --version 2>&1 | head -1)"

# 停止旧服务、清理旧配置
systemctl stop cloudflared 2>/dev/null || true
rm -rf /root/.cloudflared
mkdir -p /root/.cloudflared

# 登录
echo ""
echo "  ┌──────────────────────────────────────┐"
echo "  │  浏览器打开下面的 URL                │"
echo "  │  选择域名: ${DOMAIN}                 │"
echo "  └──────────────────────────────────────┘"
echo ""
${CF} tunnel login
ok "Cloudflare 已授权"

# 创建隧道（在 /root/.cloudflared 下执行，确保凭据文件落在这里）
cd /root/.cloudflared
${CF} tunnel create "${TUNNEL_NAME}" 2>/dev/null
TID=$(ls /root/.cloudflared/*.json 2>/dev/null | grep -v cert | head -1 | xargs basename 2>/dev/null | sed 's/\.json$//')
[ -z "${TID}" ] && TID=$(${CF} tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" | awk '{print $1}')

if [ -z "${TID}" ]; then
    warn "隧道创建失败"
else
    ok "隧道 ID: ${TID}"

    # 确保凭据文件在正确位置
    if [ ! -f "/root/.cloudflared/${TID}.json" ]; then
        # 搜索凭据文件
        FOUND=$(find /root/.cloudflared -name "*.json" -not -name "cert.pem" 2>/dev/null | head -1)
        [ -n "${FOUND}" ] && TID=$(basename "${FOUND}" .json)
    fi

    # 写配置
    cat > /root/.cloudflared/config.yml <<YML
tunnel: ${TID}
credentials-file: /root/.cloudflared/${TID}.json

ingress:
  - hostname: ${DOMAIN}
    service: http://localhost:80
  - service: http_status:404
YML

    # DNS
    ${CF} tunnel route dns "${TUNNEL_NAME}" "${DOMAIN}" 2>/dev/null

    # 安装服务
    ${CF} service install 2>/dev/null || {
        cat > /etc/systemd/system/cloudflared.service <<CFSVC
[Unit]
Description=Cloudflare Tunnel
After=network.target
[Service]
Type=simple
ExecStart=${CF} tunnel run ${TUNNEL_NAME}
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
CFSVC
        systemctl daemon-reload
    }
    ok "Tunnel 配置完成"
fi
cd /

# ============================================================
#  启动所有服务
# ============================================================
step "启动服务"

systemctl restart disi-forum
sleep 3
systemctl restart cloudflared 2>/dev/null || true
sleep 1

echo ""
echo "  ──────────── 服务状态 ────────────"

check_svc() {
    systemctl is-active "$1" &>/dev/null && echo -e "  ${G}●${N} $2 运行中" || echo -e "  ${Y}○${N} $2 异常 — 查看: journalctl -u $1 -n 10"
}

check_svc disi-forum   "后端 (disi-forum)"
check_svc nginx        "Nginx"
check_svc mariadb      "MariaDB"
check_svc cloudflared  "Cloudflare Tunnel"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        部 署 完 成                  ║"
echo "  ╠══════════════════════════════════════╣"
echo "  ║  公网:  https://${DOMAIN}      ║"
echo "  ║  账号:  disi                       ║"
echo "  ║  密码:  disi0001                   ║"
echo "  ║  上传:  ${DEPLOY_DIR}/backend/uploads/"
echo "  ╚══════════════════════════════════════╝"
echo ""
