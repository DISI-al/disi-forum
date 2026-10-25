# 桌面端（Windows）

> 应用名：DISI 论坛（`desktop/forum`）、INSIST（`desktop/insist`）

两个独立应用，共用同一后端：

| 应用 | 工程 | 产物 |
|---|---|---|
| 第四论坛 | `desktop/forum` | `第四论坛.exe` |
| INSIST | `desktop/insist` | `INSIST.exe` |

## 架构

- 渲染方式：主进程起一个只监听 `127.0.0.1:18765` 的微型静态服务器，`loadURL` 加载本地 `dist`（固定端口，登录态才能持久化）；
- 桌面构建使用 **hash 路由**（`VITE_ROUTER_MODE=hash`），网页构建仍是 history 路由；
- 默认开启硬件加速；如果上次渲染进程 `launch-failed`（exitCode 18），会自动写入 `safe-mode.flag`，下次启动用安全模式（关 GPU / 关沙箱），成功显示后自动清除；

- Electron 壳只负责窗口与本地渲染；
- 前端产物（`forum_app/dist`、`insist_app/dist`）打进安装包，打开不联网也能出界面；
- 数据全部走 `https://disi-al.com/api/*`（可用环境变量 `DISI_API` 覆盖）；
- 自定义协议 `app://` 承载 SPA 路由，外链用系统浏览器打开。

## 构建

```powershell
# 免安装目录（release/win-unpacked/*.exe）
powershell -ExecutionPolicy Bypass -File .\desktop\build-windows.ps1

# 安装包 + 免安装单文件（需要符号链接权限）
powershell -ExecutionPolicy Bypass -File .\desktop\build-windows.ps1 -Installer
```

如果不想每次都带参数，先放开当前窗口的执行策略：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\desktop\build-windows.ps1
```

> 注意：Windows 没有 `sudo`（默认禁用），提权请右键 PowerShell「以管理员身份运行」。
> 脚本内部用 `npm.cmd`，避免默认执行策略拦截 `npm.ps1`。

脚本会自动：构建对应前端 → 复制 `dist` → 用 electron-builder 打包。

## 已知问题

- **NSIS 安装包报 `Cannot create symbolic link`**：electron-builder 解压 `winCodeSign` 时需要符号链接权限。解决办法二选一：
  1. Windows 设置 → 开发者选项 → 打开「开发人员模式」；
  2. 用管理员身份运行 PowerShell 再打包。
- **缓存目录**：脚本把 electron/electron-builder 缓存放到 `local_dev/` 下，避免写入 `AppData` 被拦。
- 首次打包会下载 Electron 运行时（约 115MB），已用 npmmirror 镜像加速。

## 排查白屏 / 闪退

桌面端会把日志写到用户目录：

```
%APPDATA%\insist-desktop\desktop.log      （INSIST）
%APPDATA%\forum-desktop\desktop.log       （DISI 论坛）
```

换成打包后的应用名时目录可能不同，日志里会记录：

- `[boot]`：dist 路径、加载的 `app://` 地址、index.html 是否存在；
- `[fail-load]` / `[render-gone]`：加载失败或渲染进程崩溃；
- `[protocol-error]`：本地文件读取失败；
- `[console]`：页面里的 console 输出。

## 运行

```powershell
# 免安装版
desktop\insist\release\win-unpacked\INSIST.exe
desktop\forum\release\win-unpacked\第四论坛.exe
```

登录账号与网页端共用；因为后端已改成多端同时在线，电脑和网页可以同时登录。

## 下载页（后续）

把 `release` 里的 exe/安装包放到服务器 `/var/www/download/`，Nginx 加一个静态目录即可对外提供下载。
