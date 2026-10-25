# Install a built desktop app for the current user (no admin required).
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\desktop\install-windows.ps1 -App insist
#   powershell -ExecutionPolicy Bypass -File .\desktop\install-windows.ps1 -App forum
param(
  [ValidateSet('forum', 'insist')]
  [string]$App = 'insist',
  [string]$Dir
)

$ErrorActionPreference = 'Stop'

$apps = @{
  forum  = @{ name = 'DISI 论坛'; exe = 'DISI 论坛.exe' }
  insist = @{ name = 'INSIST';    exe = 'INSIST.exe' }
}
$meta = $apps[$App]
$src = Join-Path $PSScriptRoot "$App\release\win-unpacked"
if (-not (Test-Path $src)) {
  throw "未找到构建产物：$src（先运行 desktop\build-windows.ps1）"
}
if (-not (Test-Path (Join-Path $src $meta.exe))) {
  throw "未找到 $($meta.exe)（先运行 desktop\build-windows.ps1）"
}

if (-not $Dir) { $Dir = Join-Path $env:LOCALAPPDATA "Programs\$($meta.name)" }
New-Item -ItemType Directory -Force -Path $Dir | Out-Null

Write-Host "== 安装 $($meta.name) ==" -ForegroundColor Cyan
Write-Host "  目录: $Dir"
Copy-Item -Path (Join-Path $src '*') -Destination $Dir -Recurse -Force

$exePath = Join-Path $Dir $meta.exe
$ws = New-Object -ComObject WScript.Shell

function New-Shortcut([string]$LinkPath) {
  $lnk = $ws.CreateShortcut($LinkPath)
  $lnk.TargetPath = $exePath
  $lnk.WorkingDirectory = $Dir
  $lnk.IconLocation = $exePath
  $lnk.Description = $meta.name
  $lnk.Save()
}

$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
New-Shortcut (Join-Path $desktop ($meta.name + '.lnk'))
New-Shortcut (Join-Path $startMenu ($meta.name + '.lnk'))
Write-Host '  已创建桌面 / 开始菜单快捷方式'

$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$($meta.name)"
New-Item -Path $uninstallKey -Force | Out-Null
Set-ItemProperty -Path $uninstallKey -Name DisplayName -Value $meta.name
Set-ItemProperty -Path $uninstallKey -Name DisplayVersion -Value '0.1.0'
Set-ItemProperty -Path $uninstallKey -Name Publisher -Value 'DISI'
Set-ItemProperty -Path $uninstallKey -Name InstallLocation -Value $Dir
Set-ItemProperty -Path $uninstallKey -Name DisplayIcon -Value $exePath
Set-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -Type DWord
Set-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -Type DWord
$uninstallCmd = 'powershell -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'uninstall-windows.ps1') + '" -App ' + $App
Set-ItemProperty -Path $uninstallKey -Name UninstallString -Value $uninstallCmd
Write-Host "  已写入应用列表（$uninstallKey）"

Write-Host '完成：可以在开始菜单 / 桌面 / 设置-应用 里找到它' -ForegroundColor Green
