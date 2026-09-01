[CmdletBinding()]
param(
    [switch]$DisableDebugMode
)

$ErrorActionPreference = 'Stop'
$extensionId = 'AEExpressionAnimationManagerBasic'
$sourceRoot = $PSScriptRoot
$requiredFolders = @('CSXS', 'client', 'host')
$requiredFiles = @('package.json', 'updater-config.json')
$cepRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$targetRoot = Join-Path $cepRoot $extensionId
$debugRuntimes = @('CSXS.8', 'CSXS.9', 'CSXS.10', 'CSXS.11', 'CSXS.12', 'CSXS.13')

foreach ($folder in $requiredFolders) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $folder))) {
        throw "安装文件不完整：缺少 $folder 文件夹。请从完整插件文件夹运行安装器。"
    }
}
foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $file))) { throw "安装文件不完整：缺少 $file。" }
}

New-Item -ItemType Directory -Path $cepRoot -Force | Out-Null

$backupRoot = $null
if (Test-Path -LiteralPath $targetRoot) {
    $backupRoot = "$targetRoot.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item -LiteralPath $targetRoot -Destination $backupRoot -Force
}

try {
    New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
    foreach ($folder in $requiredFolders) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $folder) -Destination $targetRoot -Recurse -Force
    }
    foreach ($file in @('README.md', 'package.json', 'updater-config.json')) {
        if (Test-Path -LiteralPath (Join-Path $sourceRoot $file)) { Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination $targetRoot -Force }
    }

    if (-not $DisableDebugMode) {
        foreach ($runtime in $debugRuntimes) {
            $key = "HKCU:\Software\Adobe\$runtime"
            New-Item -Path $key -Force | Out-Null
            New-ItemProperty -Path $key -Name 'PlayerDebugMode' -PropertyType String -Value '1' -Force | Out-Null
        }
    }
}
catch {
    if (Test-Path -LiteralPath $targetRoot) {
        Remove-Item -LiteralPath $targetRoot -Recurse -Force
    }
    if ($backupRoot -and (Test-Path -LiteralPath $backupRoot)) { Move-Item -LiteralPath $backupRoot -Destination $targetRoot -Force }
    throw
}

Write-Host ''
Write-Host '安装完成：AE 动画管理器（基础版）' -ForegroundColor Green
Write-Host "安装位置：$targetRoot"
if ($backupRoot) { Write-Host "已保留旧基础版备份：$backupRoot" -ForegroundColor Yellow }
if (-not $DisableDebugMode) { Write-Host "已为所有常见 AE CEP 运行时启用调试模式：$($debugRuntimes -join ', ')" -ForegroundColor Yellow }
Write-Host '请完全退出并重新打开 After Effects，然后在「窗口 > 扩展」中打开「AE 动画管理器（基础版）」。'
