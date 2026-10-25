# Build a real Windows setup exe (WinForms installer inside a 7-Zip SFX shell)
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\desktop\build-installer.ps1 -App forum
#   powershell -ExecutionPolicy Bypass -File .\desktop\build-installer.ps1 -App insist
#
# 为什么用 SFX 外壳：.NET 单文件自包含运行时启动时要把 native 库解压到 %TEMP%，
# 部分机器 Temp 写入被限制会直接失败。7z SFX 可以指定解压目录到 %LOCALAPPDATA%，不碰 Temp。
param(
  [ValidateSet('forum', 'insist')]
  [string]$App = 'forum'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

$meta = @{
  forum  = @{ product = 'DISI 论坛'; exe = 'DISI 论坛.exe'; appid = 'com.disi.forum';  style = 'green' }
  insist = @{ product = 'INSIST';    exe = 'INSIST.exe';    appid = 'com.disi.insist'; style = 'mono' }
}[$App]

$appDir = Join-Path $PSScriptRoot $App
$release = Join-Path $appDir 'release'
$unpacked = Join-Path $release 'win-unpacked'
$icon = Join-Path $appDir 'build\icon.ico'

$sevenZip = 'C:\Program Files\7-Zip\7z.exe'
$sfxModule = 'C:\Program Files\7-Zip\7z.sfx'
if (-not (Test-Path $sevenZip)) { throw "需要 7-Zip：$sevenZip" }
if (-not (Test-Path $sfxModule)) { throw "需要 7-Zip SFX 模块：$sfxModule" }

if (-not (Test-Path (Join-Path $unpacked $meta.exe))) {
  throw "先构建应用：powershell -ExecutionPolicy Bypass -File .\desktop\build-windows.ps1"
}

$staging = Join-Path $PSScriptRoot ("installer\.build\" + $App)
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

# 1) 应用目录打包
$payload = Join-Path $staging 'payload.zip'
Write-Host '== 打包应用文件 ==' -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $unpacked '*') -DestinationPath $payload -CompressionLevel Optimal
Copy-Item $icon (Join-Path $staging 'appicon.ico') -Force
Copy-Item (Join-Path $PSScriptRoot 'installer\app.manifest') (Join-Path $staging 'app.manifest') -Force

# 2) 源码 + 占位符替换
$version = '0.1.0'
$program = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'installer\Program.cs'), [System.Text.Encoding]::UTF8)
$program = $program.Replace('@PRODUCT@', $meta.product).Replace('@VERSION@', $version).Replace('@APPEXE@', $meta.exe).Replace('@APPID@', $meta.appid).Replace('@STYLE@', $meta.style)
[System.IO.File]::WriteAllText((Join-Path $staging 'Program.cs'), $program, (New-Object System.Text.UTF8Encoding($true)))

$csproj = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'installer\installer.csproj'), [System.Text.Encoding]::UTF8)
$csproj = $csproj.Replace('@PRODUCT@', $meta.product).Replace('@VERSION@', $version)
[System.IO.File]::WriteAllText((Join-Path $staging 'installer.csproj'), $csproj, (New-Object System.Text.UTF8Encoding($false)))

# 3) 编译成多文件自包含程序（不做 single-file，避免任何 Temp 解压）
Write-Host '== 编译安装器（首次会慢一点）==' -ForegroundColor Cyan
$outDir = Join-Path $staging 'out'
& dotnet publish (Join-Path $staging 'installer.csproj') -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=false -p:DebugType=none -o $outDir
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish 失败' }
if (-not (Test-Path (Join-Path $outDir 'setup.exe'))) { throw "未生成 setup.exe：$outDir" }

# 4) 组装 SFX：setup 目录 + 配置
$sfxDir = Join-Path $staging 'sfx'
New-Item -ItemType Directory -Force -Path $sfxDir | Out-Null
Copy-Item (Join-Path $outDir '*') $sfxDir -Recurse -Force

$installRoot = '%LOCALAPPDATA%\DISI-Setup\' + ($meta.product -replace '[^\w\u4e00-\u9fa5.-]', '')
$config = @"
;!@Install@!UTF-8!
Title="$($meta.product) 安装程序"
InstallPath="$installRoot"
RunProgram="setup.exe"
GUIMode="2"
;!@InstallEnd@!
"@
[System.IO.File]::WriteAllText((Join-Path $staging 'config.txt'), $config, (New-Object System.Text.UTF8Encoding($false)))

$archive = Join-Path $staging 'payload.7z'
Write-Host '== 生成安装包 ==' -ForegroundColor Cyan
& $sevenZip a -t7z -mx=5 $archive (Join-Path $staging 'sfx\*') (Join-Path $staging 'config.txt') | Out-Null

$sfxExe = Join-Path $staging 'sfx-stub.exe'
Copy-Item $sfxModule $sfxExe -Force
$rcedit = Join-Path $PSScriptRoot 'bin\rcedit-x64.exe'
if (Test-Path $rcedit) {
  & $rcedit $sfxExe '--set-icon' $icon
  & $rcedit $sfxExe '--set-version-string' 'ProductName' ($meta.product + ' Setup')
  & $rcedit $sfxExe '--set-version-string' 'FileDescription' ($meta.product + ' Setup')
  & $rcedit $sfxExe '--set-version-string' 'CompanyName' 'DISI'
  & $rcedit $sfxExe '--set-file-version' '0.1.0.0'
  & $rcedit $sfxExe '--set-product-version' '0.1.0.0'
}

$target = Join-Path $release ($meta.product + ' Setup.exe')
if (Test-Path $target) { Remove-Item $target -Force }
cmd /c "copy /b `"$sfxExe`" + `"$archive`" `"$target`"" | Out-Null
if (-not (Test-Path $target)) { throw "生成安装包失败：$target" }

$size = [math]::Round((Get-Item $target).Length / 1MB, 1)
Write-Host ("安装包 -> {0} ({1} MB)" -f $target, $size) -ForegroundColor Green
