# 移动端（Android / iOS）

两个前端各自一个 Capacitor 工程：

```
mobile/
├─ forum/           DISI_FORUM（appId com.disi.forum）
├─ insist/          DISI_INSIST（appId com.disi.insist）
├─ prepare-web.mjs  把 vite 产物复制进 www/ 并注入移动端配置
└─ build-android.ps1
```

## 一、Android

### 首次：准备工具链（免管理员）

```powershell
powershell -ExecutionPolicy Bypass -File .\mobile\setup-android.ps1
```

下载到 `local_dev/toolchain/`：

- `jdk21`（Temurin JDK 21）
- `android-sdk`（cmdline-tools + platform-tools + build-tools 35 + android-35）

不会修改系统环境变量，构建脚本里临时设置。

### 构建

```powershell
# Debug APK（可直接安装，适合验证）
powershell -ExecutionPolicy Bypass -File .\mobile\build-android.ps1 -App forum
powershell -ExecutionPolicy Bypass -File .\mobile\build-android.ps1 -App insist

# 签名 Release APK（需要 local_dev/keystore/disi.jks）
powershell -ExecutionPolicy Bypass -File .\mobile\build-android.ps1 -App forum -Release
```

产物：

```
mobile/release/DISI_FORUM-debug.apk
mobile/release/DISI_INSIST-debug.apk
```

### 安装到手机

- USB 调试：`adb install -r mobile/release/DISI_FORUM-debug.apk`
- 或把 APK 传到手机，文件管理器点开安装（需允许「安装未知来源应用」）

## 二、签名密钥

`mobile/build-android.ps1 -Release` 使用 `local_dev/keystore/disi.jks`。
**这个文件不进 git，必须自己备份** —— 一旦丢失，已安装的应用将无法升级覆盖（签名不一致）。

生成（一次性）：

```powershell
$env:JAVA_HOME="local_dev\toolchain\jdk21"
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore local_dev\keystore\disi.jks `
  -alias disi -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass <密码> -keypass <密码> `
  -dname "CN=DISI, OU=DISI, O=DISI, L=, S=, C=CN"
```

然后在 `mobile/forum/android/app/build.gradle` 里加 signingConfigs（脚本会提示）。

## 三、iOS

Windows 无法编译 iOS，用 GitHub Actions 的 macOS runner 出**未签名 IPA**：

```
.github/workflows/ios-unsigned.yml
```

### 怎么跑

1. 打开仓库 → **Actions** → 左侧「iOS unsigned IPA」→ **Run workflow**；
2. 约 8–12 分钟后，页面底部 **Artifacts** 里下载：
   - `DISI_FORUM-ipa` → `DISI_FORUM-unsigned.ipa`
   - `DISI_INSIST-ipa` → `DISI_INSIST-unsigned.ipa`
3. 把 IPA 传到手机，用 Sideloadly / ESign / AltStore **自签安装**：
   - 免费 Apple ID：7 天有效期，到期重签；
   - 付费开发者账号：1 年。

> 仓库是 public，Actions 分钟数基本不限；无需在仓库里放任何证书。

### 本地能做什么

`mobile/forum/ios`、`mobile/insist/ios` 这两个 Xcode 工程已经生成（Windows 上 `npx cap add ios` 可行），
但 `pod install` 与 `xcodebuild` 只能在 macOS 上跑，所以本地 Windows 只做到「生成工程 + 提交」，编译交给 CI。

## 四、接口地址

移动端打包时注入：

```js
window.__DISI_API_BASE__ = 'https://forum.disi-al.com'
```

前端 `src/api/*.js` 已经支持这个变量（桌面端同机制），所以 WebView 里也能正常请求后端。

## 五、安全区 / 手势

`prepare-web.mjs` 会向 `index.html` 注入：

- `viewport-fit=cover`
- `padding: env(safe-area-inset-*)`
- 隐藏滚动条

返回手势（Android 物理键、iOS 侧滑）后续在原生层接 `App.addListener('backButton')` → `history.back()`。
