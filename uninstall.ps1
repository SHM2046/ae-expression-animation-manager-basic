[CmdletBinding()]
param(
    [switch]$DeleteInsteadOfBackup
)

$ErrorActionPreference = 'Stop'
$extensionId = 'AEExpressionAnimationManagerBasic'
$cepRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$removed = 0

if (-not (Test-Path -LiteralPath $cepRoot)) {
    Write-Host "未找到 CEP 扩展目录：$cepRoot" -ForegroundColor Yellow
    return
}

$target = Join-Path $cepRoot $extensionId
if (Test-Path -LiteralPath $target) {
    if ($DeleteInsteadOfBackup) { Remove-Item -LiteralPath $target -Recurse -Force }
    else { Move-Item -LiteralPath $target -Destination "$target.uninstalled-$(Get-Date -Format 'yyyyMMdd-HHmmss')" -Force }
    $removed++
}

Write-Host ''
Write-Host "已卸载 $removed 个 AE 动画管理器（基础版）目录。保留的备份不会自动删除。" -ForegroundColor Green
Write-Host '请完全退出并重新打开 After Effects。'
