#!/usr/bin/env bash
# ==============================================================
# 找出并停用「抢域名」的旧 Nginx 配置
# 用法：sudo bash deploy/fix-nginx-conflict.sh
#
# 典型症状：nginx -t 报
#   conflicting server name "disi-al.com" on 0.0.0.0:80, ignored
# 原因是旧站点配置（sites-enabled 或 conf.d 里的旧文件）仍然声明了同一个 server_name
# ==============================================================
set -uo pipefail

TARGETS=("disi-al.com" "www.disi-al.com" "forum.disi-al.com" "insist.disi-al.com")
KEEP=("disi-home.conf" "disi-forum.conf" "insist.conf")

echo "== 搜索声明了这些域名的配置 =="
FOUND=()
for d in "${TARGETS[@]}"; do
    while IFS= read -r f; do
        [ -n "${f}" ] && FOUND+=("${f}")
    done < <(grep -rl --include='*' "server_name .*${d}" /etc/nginx 2>/dev/null | sort -u)
done

printf '%s\n' "${FOUND[@]}" | sort -u | while read -r f; do
    [ -z "${f}" ] && continue
    base="$(basename "${f}")"
    keep=0
    for k in "${KEEP[@]}"; do
        [ "${base}" = "${k}" ] && keep=1
    done
    if [ "${keep}" -eq 1 ]; then
        echo "  保留  ${f}"
    else
        echo "  冲突  ${f}"
    fi
done

echo
echo "== 处理建议 =="
echo "对上面标记为「冲突」的文件，逐个停用（不要直接删，先改名备份）："
echo "  sudo mv /etc/nginx/sites-enabled/<文件名> /etc/nginx/sites-enabled/<文件名>.disabled"
echo "  # 或"
echo "  sudo mv /etc/nginx/conf.d/<文件名> /etc/nginx/conf.d/<文件名>.disabled"
echo
echo "然后执行："
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo "  sudo systemctl status nginx --no-pager | head -n 5"
echo
echo "== 当前站点文件 =="
ls -1 /etc/nginx/conf.d/ 2>/dev/null | sed 's/^/  conf.d: /'
ls -1 /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/  sites-enabled: /'
