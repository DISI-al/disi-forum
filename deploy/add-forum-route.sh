#!/usr/bin/env bash
# ==============================================================
# 给 Cloudflare Tunnel 增加 forum.disi-al.com 的入口（幂等，可重复执行）
# 用法：sudo bash deploy/add-forum-route.sh
#
# 做两件事：
#   1. 在 /root/.cloudflared/config.yml 里插入 forum.disi-al.com 的 ingress
#   2. 尝试用 cloudflared 建 DNS 路由；失败则打印面板手动添加的方法
# ==============================================================
set -euo pipefail

TUNNEL_NAME="${TUNNEL_NAME:-disi-forum}"
HOSTNAME_NEW="${HOSTNAME_NEW:-forum.disi-al.com}"
CONFIG="${CONFIG:-/root/.cloudflared/config.yml}"
SERVICE="${SERVICE:-http://localhost:80}"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
warn() { echo -e "${YELLOW}[!!]${NC}   $1"; }
err()  { echo -e "${RED}[XX]${NC}   $1"; }

[ "$(id -u)" -eq 0 ] || { err "请用 sudo 运行"; exit 1; }
[ -f "${CONFIG}" ] || { err "找不到隧道配置：${CONFIG}"; exit 1; }
command -v cloudflared >/dev/null || { err "未安装 cloudflared"; exit 1; }

cp -a "${CONFIG}" "${CONFIG}.bak.$(date +%Y%m%d%H%M%S)"
ok "已备份 ${CONFIG}"

if grep -q "hostname: ${HOSTNAME_NEW}" "${CONFIG}"; then
    ok "ingress 里已有 ${HOSTNAME_NEW}，跳过插入"
else
    # 在最后的 http_status:404 兜底规则之前插入新规则
    awk -v host="${HOSTNAME_NEW}" -v svc="${SERVICE}" '
        /- service: http_status:404/ && !done {
            print "  - hostname: " host
            print "    service: " svc
            done=1
        }
        { print }
        END { if (!done) { print "  - hostname: " host; print "    service: " svc } }
    ' "${CONFIG}" > "${CONFIG}.new"
    mv "${CONFIG}.new" "${CONFIG}"
    ok "已插入 ingress：${HOSTNAME_NEW} → ${SERVICE}"
fi

# 校验语法
if cloudflared tunnel --config "${CONFIG}" ingress validate 2>/dev/null; then
    ok "ingress 校验通过"
else
    warn "ingress 校验未通过，请检查 ${CONFIG}"
fi

systemctl restart cloudflared 2>/dev/null && ok "cloudflared 已重启" || warn "未能重启 cloudflared（手动 systemctl restart cloudflared）"

# 尝试建 DNS（local-config 模式下常因缺 cert.pem 失败）
echo
if cloudflared tunnel route dns "${TUNNEL_NAME}" "${HOSTNAME_NEW}" 2>/dev/null; then
    ok "DNS 路由已创建：${HOSTNAME_NEW}"
else
    warn "DNS 路由未能自动创建（通常是缺少 cert.pem 或该记录已存在）"
    TUNNEL_ID="$(cloudflared tunnel list 2>/dev/null | awk -v n="${TUNNEL_NAME}" '$2==n {print $1}' | head -n1)"
    [ -n "${TUNNEL_ID}" ] || TUNNEL_ID="$(grep -m1 '^tunnel:' "${CONFIG}" | awk '{print $2}')"
    echo "请到 Cloudflare 面板手动添加一条记录（DNS → Add record）："
    echo "  类型: CNAME"
    echo "  名称: forum"
    echo "  目标: ${TUNNEL_ID}.cfargotunnel.com"
    echo "  代理: 已代理（橙色云朵）"
fi

echo
echo "验证："
echo "  curl -I https://${HOSTNAME_NEW}"
echo "  curl -s https://${HOSTNAME_NEW} | head -n 5"
