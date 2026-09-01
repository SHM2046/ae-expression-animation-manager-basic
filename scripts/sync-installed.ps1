[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions\AEExpressionAnimationManagerBasic'

if (-not (Test-Path -LiteralPath $targetRoot)) {
    throw "未找到已安装插件：$targetRoot。请先在项目根目录运行 install.ps1。"
}

foreach ($folder in @('CSXS', 'client', 'host')) {
    $sourceFolder = Join-Path $sourceRoot $folder
    $targetFolder = Join-Path $targetRoot $folder
    New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null
    Copy-Item -Path (Join-Path $sourceFolder '*') -Destination $targetFolder -Recurse -Force
}
foreach ($file in @('package.json', 'updater-config.json', 'README.md')) {
    Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination $targetRoot -Force
}

Write-Host '已同步 CEP 插件文件。请完全退出并重新打开 After Effects。' -ForegroundColor Green
