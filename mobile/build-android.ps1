# 构建 Android APK（免 Android Studio，全部使用工作区内的工具链）
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\mobile\build-android.ps1 -App forum
#   powershell -ExecutionPolicy Bypass -File .\mobile\build-android.ps1 -App insist
#   ... -Release  出签名版（需要 local_dev/keystore/ 里的密钥）
param(
  [ValidateSet('forum', 'insist')][string]$App = 'forum',
  [switch]$Release
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tc = Join-Path $root 'local_dev\toolchain'

$env:JAVA_HOME = Join-Path $tc 'jdk21'
$env:ANDROID_HOME = Join-Path $tc 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Join-Path $tc 'gradle-home'
$env:ANDROID_USER_HOME = Join-Path $tc 'home\.android'
$tmpDir = Join-Path $tc 'tmp'
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME, $tmpDir | Out-Null
# Gradle/JVM 需要可写的临时目录与 user.home（用户目录被沙箱限制）
$env:TEMP = $tmpDir
$env:TMP = $tmpDir
$env:JAVA_TOOL_OPTIONS = "-Duser.home=$(Join-Path $tc 'home') -Djava.io.tmpdir=$tmpDir"
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;" + $env:PATH

if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw "缺少 JDK：$env:JAVA_HOME（先运行 mobile\setup-android.ps1）" }
if (-not (Test-Path $env:ANDROID_HOME)) { throw "缺少 Android SDK：$env:ANDROID_HOME（先运行 mobile\setup-android.ps1）" }

$web = if ($App -eq 'forum') { 'forum_app' } else { 'insist_app' }
$appDir = Join-Path $PSScriptRoot $App

Write-Host "== 构建前端 $web ==" -ForegroundColor Cyan
Push-Location (Join-Path $root $web)
node node_modules/vite/bin/vite.js build
Pop-Location

Write-Host '== 准备移动端资源 ==' -ForegroundColor Cyan
Push-Location $root
node mobile\prepare-web.mjs $App
Pop-Location

Push-Location $appDir
if (-not (Test-Path 'node_modules')) {
  Write-Host '== 安装依赖（首次较慢）==' -ForegroundColor Cyan
  & npm.cmd install --registry=https://registry.npmmirror.com --no-audit --no-fund
}

if (-not (Test-Path 'android')) {
  Write-Host '== 生成 Android 工程 ==' -ForegroundColor Cyan
  & npx.cmd cap add android
}

Write-Host '== 同步前端与原生工程 ==' -ForegroundColor Cyan
& npx.cmd cap sync android

Write-Host '== Gradle 构建 ==' -ForegroundColor Cyan
Push-Location 'android'
if ($Release) {
  & .\gradlew.bat assembleRelease --no-daemon
} else {
  & .\gradlew.bat assembleDebug --no-daemon
}
$code = $LASTEXITCODE
Pop-Location
Pop-Location

if ($code -ne 0) { throw "Gradle 构建失败（exit $code）" }

$apkDir = Join-Path $appDir 'android\app\build\outputs\apk'
$apk = Get-ChildItem $apkDir -Recurse -Filter '*.apk' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { throw "未找到 APK：$apkDir" }

$outDir = Join-Path $PSScriptRoot 'release'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$name = if ($App -eq 'forum') { 'DISI_FORUM' } else { 'DISI_INSIST' }
$target = Join-Path $outDir ("$name" + $(if ($Release) { '-release.apk' } else { '-debug.apk' }))
Copy-Item $apk.FullName $target -Force
$mb = [math]::Round((Get-Item $target).Length / 1MB, 1)
Write-Host ("APK -> {0} ({1} MB)" -f $target, $mb) -ForegroundColor Green
