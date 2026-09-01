[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $sourceRoot 'handoff'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $outputRoot "AEExpressionAnimationManager-handoff-$stamp.zip"

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

Push-Location $sourceRoot
try {
    tar.exe -a -c -f $archive CSXS client host tests docs scripts package.json README.md START_HERE.md install.ps1 '一键安装AE动画管理器.cmd' '启用CEP调试模式.reg' '手动安装说明.md'
}
finally {
    Pop-Location
}

Write-Host "交接包已生成：$archive" -ForegroundColor Green
