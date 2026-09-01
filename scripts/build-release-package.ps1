[CmdletBinding()]
param(
    [string]$Version,
    [string]$Build
)

$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json
if (-not $Version) { $Version = [string]$packageJson.version }
if (-not $Build) {
    $panelJs = Get-Content -LiteralPath (Join-Path $sourceRoot 'client\panel.js') -Raw
    if ($panelJs -match "BUILD\s*=\s*'([^']+)'") { $Build = $Matches[1] } else { $Build = Get-Date -Format 'yyyy-MM-dd' }
}

$safeVersion = ($Version -replace '[^0-9A-Za-z._-]', '-')
$safeBuild = ($Build -replace '[^0-9A-Za-z._-]', '-')
$releaseName = "AEExpressionAnimationManager-Basic-v$safeVersion"
$releaseRoot = Join-Path $sourceRoot 'releases'
$stagingRoot = Join-Path $releaseRoot '_staging'
$packageRoot = Join-Path $stagingRoot $releaseName
$latestRoot = Join-Path $releaseRoot 'latest-basic'
$zipPath = Join-Path $releaseRoot "$releaseName.zip"

if (Test-Path -LiteralPath $packageRoot) { Remove-Item -LiteralPath $packageRoot -Recurse -Force }
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

$folders = @('CSXS', 'client', 'host', 'docs', 'scripts', 'tests')

foreach ($folder in $folders) {
    $src = Join-Path $sourceRoot $folder
    if (-not (Test-Path -LiteralPath $src)) { throw "Missing release folder: $folder" }
    Copy-Item -LiteralPath $src -Destination $packageRoot -Recurse -Force
}

Get-ChildItem -LiteralPath $sourceRoot -File | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $packageRoot -Force
}

$releaseInfo = @(
    "# AE Expression Animation Manager Basic $Version",
    "",
    "Build: $Build",
    "",
    "## Install",
    "",
    "Double-click the one-click install .cmd file.",
    "",
    "## Uninstall",
    "",
    "Double-click the one-click uninstall .cmd file. By default it moves the installed extension to a backup folder instead of deleting it.",
    "",
    "## After install",
    "",
    "Fully restart After Effects, then open AE Animation Manager (Basic) from Window > Extensions."
) -join [Environment]::NewLine
Set-Content -LiteralPath (Join-Path $packageRoot 'RELEASE.md') -Value $releaseInfo -Encoding UTF8

if (Test-Path -LiteralPath $zipPath) { throw "Release package already exists. Bump version or build first: $zipPath" }
Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal

if (Test-Path -LiteralPath $latestRoot) { Remove-Item -LiteralPath $latestRoot -Recurse -Force }
Copy-Item -LiteralPath $packageRoot -Destination $latestRoot -Recurse -Force

$manifest = [ordered]@{
    version = $Version
    build = $Build
    package = (Split-Path -Leaf $zipPath)
    packagePath = $zipPath
    latestPath = $latestRoot
    createdAt = (Get-Date).ToString('s')
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseRoot 'latest-release.json') -Encoding UTF8

Remove-Item -LiteralPath $stagingRoot -Recurse -Force

Write-Host "Release package created: $zipPath" -ForegroundColor Green
Write-Host "Latest release folder: $latestRoot" -ForegroundColor Green
