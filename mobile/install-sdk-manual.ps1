# 手动安装 Android SDK 组件（绕过 sdkmanager 的网络问题）
# 用法：powershell -ExecutionPolicy Bypass -File .\mobile\install-sdk-manual.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tc = Join-Path $root 'local_dev\toolchain'
$sdk = Join-Path $tc 'android-sdk'
New-Item -ItemType Directory -Force -Path $sdk, (Join-Path $tc 'downloads') | Out-Null

function Get-File([string]$url, [string]$name) {
  $out = Join-Path $tc "downloads\$name"
  if (Test-Path $out) { Write-Host "  已存在: $name"; return $out }
  Write-Host "  下载: $name"
  $old = $ProgressPreference
  $ProgressPreference = 'SilentlyContinue'
  try { Invoke-WebRequest -Uri $url -OutFile $out -TimeoutSec 1800 -UseBasicParsing }
  finally { $ProgressPreference = $old }
  $mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
  Write-Host "  完成: $name ($mb MB)"
  return $out
}

# 1) platform-tools
$pt = Join-Path $sdk 'platform-tools'
if (-not (Test-Path (Join-Path $pt 'adb.exe'))) {
  $zip = Get-File 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' 'platform-tools.zip'
  $tmp = Join-Path $tc 'x-platform-tools'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $inner = Join-Path $tmp 'platform-tools'
  if (Test-Path $pt) { Remove-Item $pt -Recurse -Force }
  Move-Item $inner $pt
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host '  platform-tools OK' -ForegroundColor Green

# 2) platforms/android-35
$plat = Join-Path $sdk 'platforms\android-35'
if (-not (Test-Path (Join-Path $plat 'android.jar'))) {
  $zip = Get-File 'https://dl.google.com/android/repository/platform-35_r02.zip' 'platform-35.zip'
  $tmp = Join-Path $tc 'x-platform'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $inner = (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName
  New-Item -ItemType Directory -Force -Path (Split-Path $plat -Parent) | Out-Null
  if (Test-Path $plat) { Remove-Item $plat -Recurse -Force }
  Move-Item $inner $plat
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host '  platforms/android-35 OK' -ForegroundColor Green

# 3) build-tools/35.0.0
$bt = Join-Path $sdk 'build-tools\35.0.0'
if (-not (Test-Path (Join-Path $bt 'aapt2.exe'))) {
  $zip = Get-File 'https://dl.google.com/android/repository/build-tools_r35_windows.zip' 'build-tools-35.zip'
  $tmp = Join-Path $tc 'x-build-tools'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $inner = (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName
  New-Item -ItemType Directory -Force -Path (Split-Path $bt -Parent) | Out-Null
  if (Test-Path $bt) { Remove-Item $bt -Recurse -Force }
  Move-Item $inner $bt
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host '  build-tools/35.0.0 OK' -ForegroundColor Green

# 4) licenses（Gradle 需要的许可文件）
$lic = Join-Path $sdk 'licenses'
New-Item -ItemType Directory -Force -Path $lic | Out-Null
Set-Content -Path (Join-Path $lic 'android-sdk-license') -Value @(
  '24333f8a63b6825ea9c5514f83c2829b004d1fee',
  'd56f5187479451eabf01fb78af6dfcb131a6481e',
  '8933bad161af4178b1185d1a37fbf41ea5269c55'
) -Encoding ASCII
Set-Content -Path (Join-Path $lic 'android-sdk-preview-license') -Value '84831b9409646a918e30573bab4c9c91346d8abd' -Encoding ASCII
Write-Host '  licenses OK' -ForegroundColor Green

Write-Host ''
Write-Host ("ANDROID_HOME=" + $sdk) -ForegroundColor Green
Get-ChildItem $sdk | Select-Object Name
