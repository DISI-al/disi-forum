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

## 卡顿 / 画面跳动

- 桌面端已隐藏滚动条并预留滚动槽，避免出现/消失时布局抖动；
- 论坛列表的 `content-visibility: auto` 已去掉（Electron 里滚动时卡片会跳变）；
- 如果仍然卡，可对比软件渲染：

```powershell
set DISI_RENDER=software
"<解压目录>\INSIST.exe"
```

两种模式哪个更顺，就用哪个（可以在快捷方式里固定环境变量）。

## 安装包（自定义安装器，两种风格）

不依赖 NSIS / 开发者模式，用 .NET 写的安装器，界面跟产品走：

| 产品 | 安装器界面 |
|---|---|
| DISI 论坛 | GitHub 深色 + 绿按钮 |
| INSIST | 纯黑白 + 白按钮 |

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\build-installer.ps1 -App forum
powershell -ExecutionPolicy Bypass -File .\desktop\build-installer.ps1 -App insist
```

产出：

```
desktop\forum\release\DISI 论坛 Setup.exe    约 157 MB
desktop\insist\release\INSIST Setup.exe      约 157 MB
```

安装器能力：

- 小窗口，可浏览选择安装目录（默认 `%LOCALAPPDATA%\Programs\<产品名>`）
- 解压进度条 + 状态文字
- 创建桌面 / 开始菜单快捷方式（图标取自安装后的 exe）
- 写入「设置 → 应用」列表（`HKCU\...\Uninstall\<appid>`），带卸载命令
- 安装目录内生成 `uninstall.exe`，双击即可卸载（删快捷方式、注册表项、程序目录）
- 安装完成可选立即运行
- 免管理员；要装到 `Program Files` 就用管理员运行安装器、手动选目录

> 应用目录压进安装器 exe（单文件 + 自包含 .NET 运行时），所以体积约 157 MB；
> exe 与窗口图标通过 `<ApplicationIcon>` 嵌入。

## 安装到系统（免管理员脚本，备用）

不打开开发者模式也能装：脚本把文件复制到本用户目录、建开始菜单/桌面快捷方式、写入「设置 → 应用」列表和卸载入口。

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\install-windows.ps1 -App forum
powershell -ExecutionPolicy Bypass -File .\desktop\install-windows.ps1 -App insist
```

- 安装位置：`%LOCALAPPDATA%\Programs\DISI 论坛`、`%LOCALAPPDATA%\Programs\INSIST`
- 卸载：设置 → 应用 → 卸载，或 `desktop\uninstall-windows.ps1 -App insist`
- 只写 `HKCU`，不碰系统级注册表，不需要提权

> NSIS 安装包（`-Installer`）不需要开发者模式也能打包：脚本跳过 electron-builder 的签名/改资源步骤，改用自带的 `desktop\bin\rcedit-x64.exe` 给 exe 和 Setup 打图标。安装到 `C:\Program Files\DISI 论坛`（perMachine），带安装向导、可选目录、开始菜单/桌面图标、应用列表和卸载入口。
> 注意：这些 PowerShell 脚本必须保存成 **UTF-8 with BOM**，否则 PowerShell 5.1 会把中文读成乱码、直接语法报错。

## 运行

```powershell
# 免安装版
desktop\insist\release\win-unpacked\INSIST.exe
desktop\forum\release\win-unpacked\第四论坛.exe
```

登录账号与网页端共用；因为后端已改成多端同时在线，电脑和网页可以同时登录。

## 下载页（后续）

把 `release` 里的 exe/安装包放到服务器 `/var/www/download/`，Nginx 加一个静态目录即可对外提供下载。
