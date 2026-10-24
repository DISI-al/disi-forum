# DISI 技术论坛 — 部署与更新

## 目录结构

```
disi_forum/
├── backend/                  # FastAPI 后端
│   ├── main.py               # API 主程序（接口 + 静态挂载）
│   ├── models.py             # SQLAlchemy 模型
│   ├── database.py           # 数据库连接 / 建表 / 默认管理员
│   ├── auth.py               # JWT 认证
│   ├── schemas.py            # 请求 / 响应模型
│   ├── requirements.txt
│   └── uploads/              # 上传文件（运行时生成）
├── disi_vue_project/         # Vue 3 前端
│   ├── src/
│   └── dist/                 # 构建产物（部署到 nginx）
├── deploy_oneclick.sh        # 首次部署（Ubuntu / Debian 等，SQLite）
├── update.sh                 # 日常更新（拉代码 → 构建 → 重启）
├── nginx.conf                # nginx 站点配置模板
└── 运维手册.md               # 故障排查记录
```

## 一、服务器上的目录约定

| 用途 | 路径 |
|---|---|
| git 源码目录 | `/opt/disi-forum-src` |
| 后端运行目录 | `/opt/disi-forum`（含 `venv/`、`backend/`、`backend/disi_forum.db`） |
| 前端静态目录 | `/var/www/disi-forum` |
| systemd 服务 | `disi-forum.service` |
| 后端监听 | `127.0.0.1:8000`（仅本机，由 nginx 反代） |

## 二、首次部署

```bash
git clone https://github.com/DISI-al/disi-forum.git /opt/disi-forum-src
cd /opt/disi-forum-src
sudo bash deploy_oneclick.sh
```

脚本会：装系统依赖 → 建 venv 并装后端依赖 → 构建前端 → 写 nginx 配置 → 写 systemd 服务 → 放行防火墙 → 自检。
管理员账号 `DISI` 的初始口令**由脚本随机生成并在最后打印出来**（只写进 systemd 的 `ADMIN_INIT_PASSWORD`，仅首次建库生效）。

> 旧的 `deploy.sh`（CentOS + MySQL + Cloudflare）已废弃，执行会直接退出。

## 三、日常更新（最常用）

服务器上已有部署后，改完代码提交推送，然后在服务器执行：

```bash
cd /opt/disi-forum-src
sudo bash update.sh
```

`update.sh` 会依次做 7 步，任一步失败就停下并打印原因：

1. `git fetch` + `git pull --ff-only`（本地有未提交改动会失败，不会强拉）；
2. `rsync` 同步 `backend/`，**保留** `disi_forum.db`、`uploads/`、`venv/`；
3. 重装后端依赖；
4. `npm ci`（有 lockfile 时）+ `npm run build`，并校验 `dist/index.html` 存在；
5. 发布静态文件，上一版备份到 `/var/www/disi-forum.bak`；
6. 重启 `disi-forum`，`nginx -t` 通过后才 reload；
7. 健康检查：后端 `/docs`、首页 `/` 各打一次。

可用环境变量覆盖路径：`SRC_DIR` `DEPLOY_DIR` `WWW_DIR` `SERVICE` `PORT` `BRANCH` `NGINX_USER`。

### 回滚前端

```bash
sudo rm -rf /var/www/disi-forum
sudo mv /var/www/disi-forum.bak /var/www/disi-forum
sudo systemctl reload nginx
```

### 回滚后端

```bash
cd /opt/disi-forum-src
git reset --hard <上一个提交>
sudo bash update.sh
```

## 四、缓存策略（发版后看不到新页面时看这里）

- `/index.html`：`expires -1` → `Cache-Control: no-cache`，每次都回源；
- `/assets/*`：带 hash 的 JS/CSS，30 天 immutable；
- 因此正常刷新即可拿到新版本；个别浏览器强缓存时用 `Ctrl+F5`。

`nginx.conf` 模板和 `deploy_oneclick.sh` 生成的配置里都包含这条规则。

## 五、环境变量（systemd 里已设置）

| 变量 | 默认 | 说明 |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./disi_forum.db` | SQLite 路径或 PostgreSQL/MySQL 连接串 |
| `JWT_SECRET_KEY` | 随机生成 | 首次部署由脚本写进 systemd unit，**不要改成固定值** |
| `ADMIN_INIT_PASSWORD` | 首次部署脚本随机生成 | 仅当数据库里还没有 `DISI` 用户时生效；已有库不受影响 |

修改方式：

```bash
sudo systemctl edit disi-forum      # 覆盖 Environment=...
sudo systemctl restart disi-forum
```

## 六、常见问题

| 现象 | 处理 |
|---|---|
| 页面还是旧的 | 确认 nginx 里有 `location = /index.html { expires -1; }`，`sudo nginx -t && sudo systemctl reload nginx` |
| 登录后立刻掉线 | 后端重启会换 JWT，重新登录即可（单端登录设计） |
| 上传失败 | 检查 `backend/uploads` 属主为 `disi`，`client_max_body_size` 为 500M |
| 后端起不来 | `journalctl -u disi-forum -n 50 --no-pager` |
| 前端构建失败 | 看 `update.sh` 输出；Node 建议 20+ |
