#!/usr/bin/env bash
# ==============================================================
# ⚠️ 本脚本已废弃（旧版 CentOS + MySQL + Cloudflare Tunnel 部署）
#
# 现在统一使用：
#   首次部署：sudo bash deploy_oneclick.sh   （Ubuntu/Debian 等，SQLite）
#   日常更新：sudo bash update.sh
#
# 旧脚本里写死了数据库 root 口令，且目标路径/服务名与当前部署不一致，
# 继续使用会覆盖线上配置。保留此文件只为让旧调用明确失败，
# 需要旧版本请从 git 历史里取：
#   git log --oneline -- deploy.sh
#   git show <commit>:deploy.sh
# ==============================================================
set -euo pipefail

cat <<'MSG'

  [XX] deploy.sh 已废弃，未执行任何操作。

       首次部署： sudo bash deploy_oneclick.sh
       日常更新： sudo bash update.sh

MSG
exit 1
