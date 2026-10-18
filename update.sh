#!/bin/bash
# ==============================================================
# DISI 论坛 — 一键更新脚本（应用所有改进）
# 功能：头像上传、获赞统计、评论重设计、移动端适配、收藏移除
#      登录优化、用户名改 disi、文件上传修复、响应式布局
# 用法：sudo bash update.sh
# ==============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_step()  { echo -e "\n${BLUE}==== $1 ====${NC}"; }

PROJECT_DIR="/home/disi/final_demo"
DEPLOY_DIR="/opt/disi-forum"
WWW_DIR="/var/www/disi-forum"

# ==============================================================
# Step 1: 更新后端代码
# ==============================================================
update_backend() {
    log_step "Step 1/5: 更新后端代码"

    cp "${PROJECT_DIR}/backend/main.py"     "${DEPLOY_DIR}/backend/"
    cp "${PROJECT_DIR}/backend/models.py"   "${DEPLOY_DIR}/backend/"
    cp "${PROJECT_DIR}/backend/database.py" "${DEPLOY_DIR}/backend/"
    cp "${PROJECT_DIR}/backend/schemas.py"  "${DEPLOY_DIR}/backend/"
    cp "${PROJECT_DIR}/backend/auth.py"     "${DEPLOY_DIR}/backend/"

    chown -R disi:disi "${DEPLOY_DIR}/backend"
    log_info "后端代码已更新"
}

# ==============================================================
# Step 2: 数据库迁移
# ==============================================================
update_database() {
    log_step "Step 2/5: 数据库迁移"

    # 尝试多种 root 密码连接（按部署时间先后）
    MYSQL_PASS=""
    for PASS in "DisiMysql@2024" "DisiMysql2024" ""; do
        if [ -z "$PASS" ]; then
            if mysql -u root -e "SELECT 1;" &>/dev/null 2>&1; then
                MYSQL_PASS=""
                break
            fi
        elif mysql -u root -p"${PASS}" -e "SELECT 1;" &>/dev/null 2>&1; then
            MYSQL_PASS="$PASS"
            break
        fi
    done

    if [ -n "${MYSQL_PASS}" ]; then
        MYSQL_CMD="mysql -u root -p${MYSQL_PASS}"
    else
        MYSQL_CMD="mysql -u root"
    fi

    # 1) 添加 avatar_url 列（如果不存在）
    ${MYSQL_CMD} disi_forum -e "
        SELECT IF(COUNT(*)=0, 'ADD', 'SKIP') FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA='disi_forum' AND TABLE_NAME='users' AND COLUMN_NAME='avatar_url';
    " 2>/dev/null | grep -q "ADD" && {
        ${MYSQL_CMD} disi_forum -e "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER role;" 2>/dev/null
        log_info "avatar_url 列已添加"
    } || log_info "avatar_url 列已存在"

    # 2) 添加 login_version 列（单设备登录）
    ${MYSQL_CMD} disi_forum -e "
        SELECT IF(COUNT(*)=0, 'ADD', 'SKIP') FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA='disi_forum' AND TABLE_NAME='users' AND COLUMN_NAME='login_version';
    " 2>/dev/null | grep -q "ADD" && {
        ${MYSQL_CMD} disi_forum -e "ALTER TABLE users ADD COLUMN login_version VARCHAR(12) DEFAULT '1' AFTER avatar_url;" 2>/dev/null
        log_info "login_version 列已添加"
    } || log_info "login_version 列已存在"

    # 3) 重命名 admin → disi
    ${MYSQL_CMD} disi_forum -e "UPDATE users SET username='disi' WHERE username='admin';" 2>/dev/null || true
    log_info "用户名迁移: admin → disi"
}

# ==============================================================
# Step 3: 重新构建前端
# ==============================================================
rebuild_frontend() {
    log_step "Step 3/5: 重新构建前端"

    # 安装 Node.js（如果未安装）
    if ! command -v node &>/dev/null; then
        log_info "安装 Node.js 18..."
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - 2>/dev/null || true
        dnf install -y nodejs
    fi

    cd "${PROJECT_DIR}/disi_vue_project"
    log_info "安装依赖..."
    npm install --silent 2>/dev/null || npm install
    log_info "构建生产包..."
    npm run build

    log_info "部署到 ${WWW_DIR}/"
    rm -rf "${WWW_DIR:?}"/*
    cp -r dist/* "${WWW_DIR}/"
    chown -R nginx:nginx "${WWW_DIR}" 2>/dev/null || true

    cd /
    log_info "前端构建完成"
}

# ==============================================================
# Step 4: SELinux 上下文修正
# ==============================================================
fix_selinux() {
    log_step "Step 4/5: 修正 SELinux 上下文"

    if command -v restorecon &>/dev/null; then
        restorecon -R "${WWW_DIR}" 2>/dev/null || true
    fi
    if command -v setsebool &>/dev/null; then
        setsebool -P httpd_can_network_connect 1 2>/dev/null || true
    fi
    log_info "SELinux 已配置"
}

# ==============================================================
# Step 5: 重启服务
# ==============================================================
restart_services() {
    log_step "Step 5/5: 重启服务"

    systemctl restart disi-forum
    sleep 2
    systemctl reload nginx

    echo ""
    log_info "后端状态:"
    systemctl is-active disi-forum && echo "  disi-forum: ✅ 运行中" || echo "  disi-forum: ❌ 异常"
    systemctl is-active nginx && echo "  nginx: ✅ 运行中" || echo "  nginx: ❌ 异常"

    echo ""
    echo "============================================================"
    echo -e "  ${GREEN}更新完成！${NC}"
    echo "============================================================"
    echo ""
    echo "  改进内容:"
    echo "  ✅ 头像上传（点击头像即可更换）"
    echo "  ✅ 获赞统计（个人主页可见）"
    echo "  ✅ 评论样式重设计"
    echo "  ✅ 手机端适配（登录按钮、响应式布局）"
    echo "  ✅ 收藏按钮已移除"
    echo "  ✅ 登录验证（未登录无法访问论坛）"
    echo "  ✅ 文件上传修复（媒体正确关联到帖子）"
    echo "  ✅ 用户名 admin → disi"
    echo ""
    echo "  访问: https://你的域名"
    echo "  登录: 密码 disi0001"
    echo "============================================================"
}

# ==============================================================
# 主流程
# ==============================================================
main() {
    if [[ $EUID -ne 0 ]]; then
        echo "请使用 sudo 运行此脚本"
        exit 1
    fi

    echo ""
    echo "============================================================"
    echo "  DISI 论坛 — 一键更新脚本"
    echo "============================================================"

    update_backend
    update_database
    rebuild_frontend
    fix_selinux
    restart_services
}

main "$@"
