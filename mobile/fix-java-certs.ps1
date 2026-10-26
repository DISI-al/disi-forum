# 把 Windows 根证书导入工作区里的 JDK cacerts（解决 Gradle/Java 的 PKIX 证书错误）
# 用法：powershell -ExecutionPolicy Bypass -File .\mobile\fix-java-certs.ps1
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
$tc = Join-Path $root 'local_dev\toolchain'
$jdk = Join-Path $tc 'jdk21'
$keytool = Join-Path $jdk 'bin\keytool.exe'
$cacerts = Join-Path $jdk 'lib\security\cacerts'

if (-not (Test-Path $keytool)) { throw "找不到 keytool：$keytool" }

$backup = Join-Path $tc 'cacerts.backup'
if (-not (Test-Path $backup)) {
  Copy-Item $cacerts $backup
  Write-Host "已备份 cacerts -> $backup"
}

$tmp = Join-Path $tc 'certs'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$added = 0
$skipped = 0

foreach ($store in 'Cert:\LocalMachine\Root', 'Cert:\LocalMachine\CA') {
  foreach ($cert in Get-ChildItem $store -ErrorAction SilentlyContinue) {
    $file = Join-Path $tmp ($cert.Thumbprint + '.cer')
    if (-not (Test-Path $file)) {
      try {
        [IO.File]::WriteAllBytes($file, $cert.RawData)
      }
      catch { continue }
    }
    & $keytool -importcert -noprompt -alias ("win-" + $cert.Thumbprint) `
      -file $file -keystore $cacerts -storepass changeit 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $added++ } else { $skipped++ }
  }
}

Write-Host ""
Write-Host "导入完成：新增 $added 个，跳过 $skipped 个（已存在或格式不支持）" -ForegroundColor Green
Write-Host "JDK: $jdk"
Write-Host "如需恢复：Copy-Item '$backup' '$cacerts' -Force"
