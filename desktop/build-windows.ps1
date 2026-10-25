# Build Windows apps (ASCII only, works on PowerShell 5.1)
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\desktop\build-windows.ps1
#   powershell -ExecutionPolicy Bypass -File .\desktop\build-windows.ps1 -Installer
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

$rcedit = Join-Path $PSScriptRoot 'bin\rcedit-x64.exe'
$hasRcedit = Test-Path $rcedit

$apps = @(
  @{ name = 'forum';  web = 'forum_app';  product = 'DISI-Forum'; label = 'DISI Forum' },
  @{ name = 'insist'; web = 'insist_app'; product = 'INSIST';     label = 'INSIST' }
)

foreach ($app in $apps) {
  Write-Host "== $($app.product) ==" -ForegroundColor Cyan
  $dir = Join-Path $PSScriptRoot $app.name
  $web = Join-Path $root $app.web

  # Desktop build uses hash routing so file:// works without a custom protocol
  $env:VITE_ROUTER_MODE = 'hash'
  Push-Location $web
  node node_modules/vite/bin/vite.js build
  Pop-Location
  Remove-Item Env:VITE_ROUTER_MODE -ErrorAction SilentlyContinue

  Push-Location $dir
  if (-not (Test-Path 'node_modules')) {
    & npm.cmd install --registry=https://registry.npmmirror.com --no-audit --no-fund
  }
  & npm.cmd run copy:web

  $builder = Join-Path $dir 'node_modules\.bin\electron-builder.cmd'
  if (-not (Test-Path $builder)) { throw "electron-builder not installed in $dir" }

  $icon = Join-Path $dir 'build\icon.ico'
  $exeName = (& node -e "process.stdout.write(require('./package.json').build.productName)")

  if ($Installer) {
    # signAndEditExecutable=false: skip electron-builder's signing tool download,
    # we embed the icon ourselves with rcedit below.
    & $builder '--win' 'nsis' 'portable' '--config.win.signAndEditExecutable=false'
  } else {
    & $builder '--win' 'dir' '--config.win.signAndEditExecutable=false'
  }

  if (-not (Test-Path $icon)) { throw "icon missing: $icon" }

  $unpacked = Join-Path $dir 'release\win-unpacked'
  $appExe = Join-Path $unpacked ($exeName + '.exe')
  if ($hasRcedit -and (Test-Path $appExe)) {
    & $rcedit $appExe '--set-icon' $icon
    & $rcedit $appExe '--set-version-string' 'ProductName' $exeName
    & $rcedit $appExe '--set-version-string' 'FileDescription' $exeName
    & $rcedit $appExe '--set-version-string' 'CompanyName' 'DISI'
    & $rcedit $appExe '--set-version-string' 'LegalCopyright' 'DISI'
    & $rcedit $appExe '--set-file-version' '0.1.0.0'
    & $rcedit $appExe '--set-product-version' '0.1.0.0'
    Write-Host "  icon -> $appExe" -ForegroundColor Green
  }

  if ($Installer) {
    $setup = Get-ChildItem (Join-Path $dir 'release') -Filter '*Setup*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hasRcedit -and $setup) {
      & $rcedit $setup.FullName '--set-icon' $icon
      Write-Host "  icon -> $($setup.Name)" -ForegroundColor Green
    }
  } else {
    if (Test-Path $unpacked) {
      $zip = Join-Path $dir ('release\' + $app.product + '-win-x64.zip')
      if (Test-Path $zip) { Remove-Item $zip -Force }
      Compress-Archive -Path (Join-Path $unpacked '*') -DestinationPath $zip -CompressionLevel Optimal
      Write-Host "  zip -> $zip" -ForegroundColor Green
    }
  }
  Pop-Location

  $out = Join-Path $dir 'release'
  Write-Host "  -> $out" -ForegroundColor Green
}

Write-Host 'Done.' -ForegroundColor Green
Write-Host 'Run: desktop\<app>\release\win-unpacked\<App>.exe  (or the Setup exe / portable zip)'
