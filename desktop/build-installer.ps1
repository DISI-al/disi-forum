# Build a real Windows setup exe (WinForms installer, no NSIS needed)
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\desktop\build-installer.ps1 -App forum
#   powershell -ExecutionPolicy Bypass -File .\desktop\build-installer.ps1 -App insist
param(
  [ValidateSet('forum', 'insist')]
  [string]$App = 'forum'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

$meta = @{
  forum  = @{ product = 'DISI_FORUM'; exe = 'DISI 论坛.exe'; appid = 'com.disi.forum';  zip = 'DISI-Forum-win-x64.zip'; style = 'green' }
  insist = @{ product = 'DISI_INSIST';    exe = 'INSIST.exe';    appid = 'com.disi.insist'; zip = 'INSIST-win-x64.zip'; style = 'mono' }
}[$App]

$appDir = Join-Path $PSScriptRoot $App
$release = Join-Path $appDir 'release'
$unpacked = Join-Path $release 'win-unpacked'
$icon = Join-Path $appDir 'build\icon.ico'

if (-not (Test-Path (Join-Path $unpacked $meta.exe))) {
  throw "先构建应用：powershell -ExecutionPolicy Bypass -File .\desktop\build-windows.ps1"
}

$staging = Join-Path $PSScriptRoot ("installer\.build\" + $App)
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

# payload = 应用目录打包
$payload = Join-Path $staging 'payload.zip'
Write-Host '== 打包应用文件 ==' -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $unpacked '*') -DestinationPath $payload -CompressionLevel Optimal
Copy-Item $icon (Join-Path $staging 'appicon.ico') -Force
Copy-Item (Join-Path $PSScriptRoot 'installer\app.manifest') (Join-Path $staging 'app.manifest') -Force

# 源码 + 占位符替换
$version = '0.1.0'
$program = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'installer\Program.cs'), [System.Text.Encoding]::UTF8)
$program = $program.Replace('@PRODUCT@', $meta.product).Replace('@VERSION@', $version).Replace('@APPEXE@', $meta.exe).Replace('@APPID@', $meta.appid).Replace('@STYLE@', $meta.style)
[System.IO.File]::WriteAllText((Join-Path $staging 'Program.cs'), $program, (New-Object System.Text.UTF8Encoding($true)))

$csproj = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'installer\installer.csproj'), [System.Text.Encoding]::UTF8)
$csproj = $csproj.Replace('@PRODUCT@', $meta.product).Replace('@VERSION@', $version)
[System.IO.File]::WriteAllText((Join-Path $staging 'installer.csproj'), $csproj, (New-Object System.Text.UTF8Encoding($false)))

Write-Host '== 编译安装器（首次会慢一点）==' -ForegroundColor Cyan
$outDir = Join-Path $staging 'out'
& dotnet publish (Join-Path $staging 'installer.csproj') -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=false -p:IncludeAllContentForSelfExtract=false `
  -p:EnableCompressionInSingleFile=false -o $outDir
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish 失败' }

$setupSrc = Join-Path $outDir 'setup.exe'
if (-not (Test-Path $setupSrc)) { throw "未生成 setup.exe：$outDir" }

$target = Join-Path $release ($meta.product + ' Setup.exe')
Copy-Item $setupSrc $target -Force
$size = [math]::Round((Get-Item $target).Length / 1MB, 1)
Write-Host ("安装包 -> {0} ({1} MB)" -f $target, $size) -ForegroundColor Green
