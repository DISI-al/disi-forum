# 下载 Android 构建工具链到 local_dev/toolchain（免管理员、不污染系统）
# 用法：powershell -ExecutionPolicy Bypass -File .\mobile\setup-android.ps1
param(
  [switch]$SkipJdk,
  [switch]$SkipSdk
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tc = Join-Path $root 'local_dev\toolchain'
New-Item -ItemType Directory -Force -Path $tc | Out-Null

function Get-File([string]$url, [string]$out) {
  if (Test-Path $out) {
    Write-Host "  已存在: $(Split-Path $out -Leaf)"
    return
  }
  Write-Host "  下载: $url"
  $old = $ProgressPreference
  $ProgressPreference = 'SilentlyContinue'
  try {
    Invoke-WebRequest -Uri $url -OutFile $out -TimeoutSec 1800 -UseBasicParsing
  }
  finally {
    $ProgressPreference = $old
  }
  $mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
  Write-Host "  完成: $(Split-Path $out -Leaf) ($mb MB)"
}

# ---------- JDK 21 ----------
if (-not $SkipJdk) {
  Write-Host '== JDK 21 ==' -ForegroundColor Cyan
  $jdkDir = Join-Path $tc 'jdk21'
  if (-not (Test-Path (Join-Path $jdkDir 'bin\java.exe'))) {
    $zip = Join-Path $tc 'jdk21.zip'
    Get-File 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' $zip
    $tmp = Join-Path $tc 'jdk21-extract'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Write-Host '  解压 JDK…'
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
    if (-not $inner) { throw 'JDK 解压结构异常' }
    if (Test-Path $jdkDir) { Remove-Item $jdkDir -Recurse -Force }
    Move-Item $inner.FullName $jdkDir
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
  Write-Host "  JAVA_HOME -> $jdkDir" -ForegroundColor Green
}

# ---------- Android SDK ----------
if (-not $SkipSdk) {
  Write-Host '== Android SDK 命令行工具 ==' -ForegroundColor Cyan
  $sdkDir = Join-Path $tc 'android-sdk'
  $cmdDir = Join-Path $sdkDir 'cmdline-tools\latest'

  if (-not (Test-Path (Join-Path $cmdDir 'bin\sdkmanager.bat'))) {
    $zip = Join-Path $tc 'cmdline-tools.zip'
    Get-File 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' $zip
    $tmp = Join-Path $tc 'cmdline-tools-extract'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Write-Host '  解压 cmdline-tools…'
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $inner = Join-Path $tmp 'cmdline-tools'
    if (-not (Test-Path $inner)) { $inner = (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName }
    New-Item -ItemType Directory -Force -Path (Split-Path $cmdDir -Parent) | Out-Null
    if (Test-Path $cmdDir) { Remove-Item $cmdDir -Recurse -Force }
    Move-Item $inner $cmdDir
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
  Write-Host "  ANDROID_HOME -> $sdkDir" -ForegroundColor Green

  $env:JAVA_HOME = Join-Path $tc 'jdk21'
  $env:ANDROID_HOME = $sdkDir
  $env:ANDROID_SDK_ROOT = $sdkDir
  $sdkmanager = Join-Path $cmdDir 'bin\sdkmanager.bat'
  if (-not (Test-Path $sdkmanager)) { throw "未找到 sdkmanager：$sdkmanager" }

  Write-Host '  接受许可协议…'
  $y = ("y`n" * 30)
  $y | & $sdkmanager --licenses
  Write-Host '  安装 platform-tools / build-tools / platforms…'
  & $sdkmanager 'platform-tools' 'build-tools;35.0.0' 'platforms;android-35' 'cmdline-tools;latest'
}

Write-Host ''
Write-Host '完成。' -ForegroundColor Green
Write-Host ("  JAVA_HOME=" + (Join-Path $tc 'jdk21'))
Write-Host ("  ANDROID_HOME=" + (Join-Path $tc 'android-sdk'))
