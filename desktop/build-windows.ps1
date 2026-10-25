# Build Windows apps (ASCII only, works on PowerShell 5.1)
# Usage:
#   powershell -ExecutionPolicy Bypass -File desktop\build-windows.ps1
#   powershell -ExecutionPolicy Bypass -File desktop\build-windows.ps1 -Installer
param(
  [switch]$Installer
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$cacheRoot = Join-Path $root 'local_dev'

$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
$env:ELECTRON_CACHE = Join-Path $cacheRoot 'electron-cache'
$env:ELECTRON_BUILDER_CACHE = Join-Path $cacheRoot 'eb-cache'
New-Item -ItemType Directory -Force -Path $env:ELECTRON_CACHE, $env:ELECTRON_BUILDER_CACHE | Out-Null

$apps = @(
  @{ name = 'forum';  web = 'forum_app';  product = '第四论坛' },
  @{ name = 'insist'; web = 'insist_app'; product = 'INSIST' }
)

foreach ($app in $apps) {
  Write-Host "== $($app.product) ==" -ForegroundColor Cyan
  $dir = Join-Path $PSScriptRoot $app.name
  $web = Join-Path $root $app.web

  Push-Location $web
  node node_modules/vite/bin/vite.js build
  Pop-Location

  Push-Location $dir
  if (-not (Test-Path 'node_modules')) {
    npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
  }
  npm run copy:web

  if ($Installer) {
    npx electron-builder --win nsis portable
  } else {
    npx electron-builder --win dir -c.win.signAndEditExecutable=false
  }
  Pop-Location

  $out = Join-Path $dir 'release'
  Write-Host "  -> $out" -ForegroundColor Green
}

Write-Host 'Done.' -ForegroundColor Green
Write-Host 'Tip: NSIS installer needs symlink privilege (Developer Mode or admin shell).'
