# DISI 论坛 — 运维管理文档

> **域名**: https://disi-al.com  
> **服务器**: CentOS Stream 10 虚拟机  
> **内网穿透**: Cloudflare Tunnel  
> **最后更新**: 2026-05-03

---

## 一、项目架构

```
浏览器 (公网)
    │
    ▼
Cloudflare CDN (disi-al.com)
    │
    ▼
Cloudflare Tunnel (cloudflared)
    │
    ▼
Nginx (80端口) ──→ Vue 前端静态文件 (/var/www/disi-forum/)
    │               └── SPA 路由，/api/ 和 /uploads/ 代理到后端
    ▼
FastAPI (127.0.0.1:8000, uvicorn workers×4)
    │
    ▼
MariaDB (127.0.0.1:3306, disi_forum)
```

| 组件  | 技术                   | 端口             | 进程守护                 |
| --- | -------------------- | -------------- | -------------------- |
| 前端  | Vue 3 + Vite         | Nginx:80       | systemd: nginx       |
| 后端  | FastAPI + SQLAlchemy | 127.0.0.1:8000 | systemd: disi-forum  |
| 数据库 | MariaDB 10.11        | 127.0.0.1:3306 | systemd: mariadb     |
| 隧道  | cloudflared          | —              | systemd: cloudflared |

---

## 二、服务器目录结构

```
/home/disi/final_demo/          # 源代码（上传于此）
    ├── backend/                 # Python 后端源码
    ├── disi_vue_project/        # Vue 前端源码
    ├── database/                # SQL 初始化脚本
    ├── deploy.sh                # 一键部署脚本
    └── update.sh                # 一键更新脚本

/opt/disi-forum/                 # 生产部署目录
    ├── backend/                 # 运行中的后端代码
    │   └── uploads/             # 用户上传的文件（图片/视频/附件）
    └── venv/                    # Python 虚拟环境

/var/www/disi-forum/             # Nginx 静态文件（前端 dist）
/etc/nginx/conf.d/disi-forum.conf  # Nginx 站点配置
/etc/systemd/system/disi-forum.service  # 后端 systemd 服务
/etc/systemd/system/cloudflared.service # Tunnel systemd 服务
```

---

## 三、服务管理命令

### 3.1 状态查看

```bash
# 全部服务状态
systemctl status disi-forum
systemctl status nginx
systemctl status mariadb
systemctl status cloudflared

# 一行看全部
systemctl is-active disi-forum nginx mariadb cloudflared
```

### 3.2 启动 / 停止 / 重启

```bash
systemctl restart disi-forum    # 重启后端
systemctl reload nginx          # 重载 Nginx（不中断服务）
systemctl restart nginx         # 重启 Nginx
systemctl restart cloudflared   # 重启 Tunnel
systemctl restart mariadb       # 重启数据库
```

### 3.3 日志查看

```bash
journalctl -u disi-forum -f     # 后端实时日志
journalctl -u disi-forum -n 50  # 后端最近 50 行
journalctl -u cloudflared -f    # Tunnel 实时日志
journalctl -u cloudflared -n 20 # Tunnel 最近 20 行
tail -f /var/log/nginx/disi-forum-error.log  # Nginx 错误日志
```

### 3.4 开机自启

所有服务已配置 `systemctl enable`，重启服务器后自动启动。如需检查：

```bash
systemctl is-enabled disi-forum nginx mariadb cloudflared
```

---

## 四、用户管理

### 4.1 添加用户

```bash
cd /opt/disi-forum/backend
source /opt/disi-forum/venv/bin/activate
DATABASE_URL="mysql+pymysql://disi:DisiForum2024@127.0.0.1:3306/disi_forum" python add_user.py 用户名 密码 [admin|user]
deactivate
```

**示例**:

```bash
# 添加普通用户
DATABASE_URL="mysql+pymysql://disi:DisiForum2024@127.0.0.1:3306/disi_forum" python add_user.py zhangsan mypass123

# 添加管理员
DATABASE_URL="mysql+pymysql://disi:DisiForum2024@127.0.0.1:3306/disi_forum" python add_user.py wangwu mypass456 admin
```

### 4.2 查看所有用户

```bash
cd /opt/disi-forum/backend
source /opt/disi-forum/venv/bin/activate
DATABASE_URL="mysql+pymysql://disi:DisiForum2024@127.0.0.1:3306/disi_forum" python add_user.py --list
deactivate
```

### 4.3 直接在数据库操作

```bash
mysql -u root -p"DisiMysql2024" disi_forum

# 查看所有用户
SELECT id, username, role, created_at FROM users;

# 删除用户
DELETE FROM users WHERE username='zhangsan';

# 修改密码
UPDATE users SET hashed_password='<python生成的hash>' WHERE username='zhangsan';

# 退出
exit
```

---

## 五、数据库信息

| 项目      | 值                                            |
| ------- | -------------------------------------------- |
| 类型      | MariaDB (MySQL 兼容)                           |
| 数据库名    | `disi_forum`                                 |
| Root 密码 | `DisiMysql2024`                              |
| 应用用户    | `disi`                                       |
| 应用密码    | `DisiForum2024`                              |
| 连接命令    | `mysql -u root -p"DisiMysql2024" disi_forum` |

### 数据表

| 表名          | 说明           |
| ----------- | ------------ |
| `users`     | 用户（含头像、登录版本） |
| `posts`     | 帖子           |
| `comments`  | 评论           |
| `likes`     | 点赞           |
| `favorites` | 收藏（已弃用）      |
| `media`     | 上传文件         |

---

## 六、Cloudflare Tunnel 管理

### 6.1 状态检查

```bash
/usr/local/bin/cloudflared tunnel list
/usr/local/bin/cloudflared tunnel info disi-forum
```

### 6.2 手动重启 Tunnel

```bash
systemctl restart cloudflared
```

### 6.3 DNS 绑定

如域名变更或 DNS 丢失，在 Cloudflare 控制台添加 CNAME 记录：

```
名称: @ (或 disi-al.com)
目标: <tunnel-id>.cfargotunnel.com
代理: 已代理（橙色云朵）
```

Tunnel ID 查看方式：`cat /root/.cloudflared/config.yml | head -2`

### 6.4 完全重建 Tunnel

```bash
CF="/usr/local/bin/cloudflared"
systemctl stop cloudflared
rm -rf /root/.cloudflared
mkdir -p /root/.cloudflared
cd /root/.cloudflared
${CF} tunnel login        # 浏览器授权
${CF} tunnel create disi-forum
# 记下生成的 .json 文件名（即 tunnel ID）
# 编辑 config.yml，写入：
#   tunnel: <ID>
#   credentials-file: /root/.cloudflared/<ID>.json
#   ingress:
#     - hostname: disi-al.com
#       service: http://localhost:80
#     - service: http_status:404
${CF} tunnel route dns disi-forum disi-al.com
${CF} service install
systemctl enable --now cloudflared
```

---

## 七、备份与恢复

### 7.1 备份数据库

```bash
# 导出到 SQL 文件
mysqldump -u root -p"DisiMysql2024" disi_forum > /home/disi/backup_$(date +%Y%m%d).sql

# 备份上传文件
tar -czf /home/disi/uploads_backup_$(date +%Y%m%d).tar.gz /opt/disi-forum/backend/uploads/
```

### 7.2 恢复数据库

```bash
# 先清空重建
mysql -u root -p"DisiMysql2024" -e "DROP DATABASE IF EXISTS disi_forum; CREATE DATABASE disi_forum CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# 导入备份
mysql -u root -p"DisiMysql2024" disi_forum < /home/disi/backup_20260503.sql
# 重启后端
systemctl restart disi-forum
```

### 7.3 建议

- 每月手动备份一次数据库
- 重要帖子前做一次备份
- 备份文件下载到本机保存

---

## 八、故障排查

### 8.1 网站打不开（530 或 1033 错误）

```bash
systemctl status cloudflared     # 检查 Tunnel
systemctl restart cloudflared    # 重启
journalctl -u cloudflared -n 20  # 看日志
```

### 8.2 页面能打开但 API 报 502

```bash
systemctl status disi-forum     # 检查后端
journalctl -u disi-forum -n 20  # 看后端日志
curl -s http://127.0.0.1:8000/  # 直接测试
systemctl restart disi-forum    # 重启
```

### 8.3 登录/头像/发帖失败

通常是因为数据库重建后 JWT 密钥变了：

1. 浏览器清除 `disi-al.com` 的 localStorage
2. 重新打开 `https://disi-al.com/login` 登录

### 8.4 前端没更新

```bash
cd /home/disi/final_demo/disi_vue_project
rm -rf node_modules/.bin
npm install
npm run build
rm -rf /var/www/disi-forum/*
cp -r dist/* /var/www/disi-forum/
chown -R nginx:nginx /var/www/disi-forum
systemctl reload nginx
```

### 8.5 后端启动失败

```bash
journalctl -u disi-forum -n 30
# 常见原因: 数据库连接不上 → 检查 mariadb 服务
#         : 代码语法错误 → 检查 /opt/disi-forum/backend/*.py
```

---

## 九、关键配置与服务文件

### disi-forum.service

```
/etc/systemd/system/disi-forum.service
Environment="DATABASE_URL=mysql+pymysql://disi:DisiForum2024@127.0.0.1:3306/disi_forum"
ExecStart=/opt/disi-forum/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always, RestartSec=10  → 崩溃自动重启
```

### Nginx 配置

```
/etc/nginx/conf.d/disi-forum.conf
最大上传: 500MB
/api/  → 代理到 127.0.0.1:8000
/uploads/ → 代理到 127.0.0.1:8000
```

### Cloudflare Tunnel 配置

```
/root/.cloudflared/config.yml
/etc/cloudflared/config.yml
```

---

## 十、默认账号

| 用户名  | 密码       | 角色  |
| ---- | -------- | --- |
| DISI | disi0001 | 管理员 |

**重要：部署完成后尽快修改默认密码！**

---

## 附录：完整部署流程

在新服务器上部署：

```bash
# 1. 上传 final_demo 到 /home/disi/
# 2. 域名 disi-al.com 托管到 Cloudflare（DNS 服务器改为 Cloudflare 的）
# 3. 运行
cd /home/disi/final_demo
chmod +x deploy.sh
sudo bash deploy.sh
# 4. 浏览器打开打印的 URL 授权 Cloudflare
# 5. 等待脚本完成
```

  python3 -c "                                                                                                            
  from models import User                                                                                                 
  h = User.hash_password('123456hds')                                                                                     
  print(h)                                                                                                                
  "
