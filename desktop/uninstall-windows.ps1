# Uninstall a desktop app installed by install-windows.ps1 (current user).
param(
  [ValidateSet('forum', 'insist')]
  [string]$App = 'insist',
  [string]$Dir
)

$ErrorActionPreference = 'Continue'

$apps = @{
  forum  = @{ name = 'DISI 论坛'; exe = 'DISI 论坛.exe' }
  insist = @{ name = 'INSIST';    exe = 'INSIST.exe' }
}
$meta = $apps[$App]
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$($meta.name)"
if (-not $Dir) {
  try {
    $Dir = (Get-ItemProperty -Path $uninstallKey -Name InstallLocation -ErrorAction Stop).InstallLocation
  } catch {
    $Dir = Join-Path $env:LOCALAPPDATA "Programs\$($meta.name)"
  }
}

$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
foreach ($lnk in @((Join-Path $desktop ($meta.name + '.lnk')), (Join-Path $startMenu ($meta.name + '.lnk')))) {
  if (Test-Path $lnk) { Remove-Item $lnk -Force; Write-Host "已删除快捷方式 $lnk" }
}

if (Test-Path $uninstallKey) {
  Remove-Item $uninstallKey -Recurse -Force
  Write-Host '已从应用列表移除'
}

if ($Dir -and (Test-Path $Dir)) {
  Remove-Item $Dir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "已删除目录 $Dir"
}

Write-Host '卸载完成' -ForegroundColor Green
