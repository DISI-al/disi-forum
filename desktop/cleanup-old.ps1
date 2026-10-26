# 清理旧安装残留（历史版本的 DISI 论坛 / INSIST / DISI_FORUM / DISI_INSIST）
# 用法（管理员）：powershell -ExecutionPolicy Bypass -File .\desktop\cleanup-old.ps1
$ErrorActionPreference = 'SilentlyContinue'

$names = @('DISI 论坛', 'INSIST', 'DISI_FORUM', 'DISI_INSIST', 'DISI Forum', 'INSIST App')
$exes = @('DISI 论坛', 'INSIST', 'DISI_FORUM', 'DISI_INSIST', 'setup', 'uninstall')

Write-Host '== 结束残留进程 ==' -ForegroundColor Cyan
foreach ($e in $exes) {
  Get-Process -Name $e -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  kill $($_.ProcessName) ($($_.Id))"
    $_.Kill()
  }
}
Start-Sleep -Milliseconds 800

Write-Host '== 删除快捷方式 ==' -ForegroundColor Cyan
$folders = @(
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('Programs'),
  [Environment]::GetFolderPath('CommonPrograms')
)
foreach ($f in $folders) {
  if (-not $f) { continue }
  foreach ($n in $names) {
    $lnk = Join-Path $f ($n + '.lnk')
    if (Test-Path $lnk) { Remove-Item $lnk -Force; Write-Host "  rm $lnk" }
  }
}

Write-Host '== 删除注册表项 ==' -ForegroundColor Cyan
foreach ($id in @('com.disi.forum', 'com.disi.insist')) {
  $key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$id"
  if (Test-Path $key) { Remove-Item $key -Recurse -Force; Write-Host "  rm $key" }
  $key2 = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$id"
  if (Test-Path $key2) { Remove-Item $key2 -Recurse -Force; Write-Host "  rm $key2" }
}

Write-Host '== 删除安装目录 ==' -ForegroundColor Cyan
$roots = @(
  (Join-Path $env:LOCALAPPDATA 'Programs'),
  'C:\Program Files',
  'C:\Program Files (x86)'
)
foreach ($root in $roots) {
  foreach ($n in $names) {
    $dir = Join-Path $root $n
    if (Test-Path $dir) {
      Remove-Item $dir -Recurse -Force
      if (Test-Path $dir) { Write-Host "  需手动删除: $dir" -ForegroundColor Yellow }
      else { Write-Host "  rm $dir" }
    }
  }
}

Write-Host '== 完成 ==' -ForegroundColor Green
Write-Host '如果还有残留，请检查: %LOCALAPPDATA%\Programs 与 桌面/开始菜单'
