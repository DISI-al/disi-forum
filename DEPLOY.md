# DISI 技术论坛 — Linux 服务器部署指南

## 项目结构

```
final_demo/
├── disi_vue_project/dist/   # 前端打包文件（部署到 nginx）
├── backend/                  # FastAPI 后端
│   ├── main.py               # API 主程序
│   ├── models.py             # 数据库模型
│   ├── database.py           # 数据库连接
│   ├── auth.py               # JWT 认证
│   ├── schemas.py            # 请求/响应模型
│   ├── requirements.txt      # Python 依赖
│   └── uploads/              # 上传文件目录
├── database/
│   ├── init_postgres.sql     # PostgreSQL 初始化脚本
│   └── init_mysql.sql        # MySQL 初始化脚本
└── nginx.conf                # Nginx 配置
```

## 一、环境要求

- Linux 服务器（Ubuntu 20.04+ / Debian / CentOS 7+）
- Python 3.10+
- Nginx
- SQLite（默认，无需安装）或 PostgreSQL / MySQL

---

## 二、部署后端

### 1. 安装 Python 依赖

```bash
# 把 backend 目录上传到服务器的 /opt/disi-forum/backend/
cd /opt/disi-forum/backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量（可选）

```bash
# 默认使用 SQLite，无需额外配置
# 如果要用 PostgreSQL，设置：
export DATABASE_URL="postgresql://user:password@localhost/disi_forum"
export JWT_SECRET_KEY="your-random-secret-key"
```

### 3. 启动后端

```bash
# 开发/测试（前台运行）
uvicorn main:app --host 0.0.0.0 --port 8000

# 生产环境（后台运行，使用 systemd）
```

### 4. 配置 systemd 服务（推荐）

创建 `/etc/systemd/system/disi-forum.service`：

```ini
[Unit]
Description=DISI Forum Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/disi-forum/backend
Environment="DATABASE_URL=sqlite:////opt/disi-forum/backend/disi_forum.db"
Environment="JWT_SECRET_KEY=your-random-secret-key"
ExecStart=/opt/disi-forum/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now disi-forum
sudo systemctl status disi-forum
```

---

## 三、部署前端

### 1. 上传前端文件

```bash
# 把 disi_vue_project/dist/ 下的所有文件复制到 nginx 目录
sudo mkdir -p /var/www/disi-forum
sudo cp -r dist/* /var/www/disi-forum/
sudo chown -R www-data:www-data /var/www/disi-forum
```

### 2. 配置 Nginx

```bash
# 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/disi-forum

# 启用站点
sudo ln -s /etc/nginx/sites-available/disi-forum /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 nginx
sudo nginx -s reload
```

---

## 四、数据库初始化（可选）

默认使用 SQLite，后端启动时会自动建表和创建管理员账号，**无需手动操作**。

如果使用 PostgreSQL 或 MySQL，先执行对应的初始化脚本：

```bash
# PostgreSQL
sudo -u postgres psql -f database/init_postgres.sql

# MySQL
mysql -u root -p < database/init_mysql.sql
```

---

## 五、验证部署

1. 打开浏览器访问 `http://服务器IP`
2. 输入密码 `disi0001` 登录
3. 可以发帖、评论、点赞、收藏

---

## 六、默认管理员

| 字段 | 值 |
|------|-----|
| 用户名 | admin |
| 密码 | disi0001 |
| 角色 | admin |

---

## 七、注意事项

1. **JWT_SECRET_KEY** 生产环境务必修改为随机字符串
2. **上传文件** 保存在 backend/uploads/ 目录，确保有写入权限
3. **防火墙** 确保 80 端口对外开放，8000 端口仅本机访问
4. **HTTPS** 生产环境建议配置 SSL 证书（Let's Encrypt）
