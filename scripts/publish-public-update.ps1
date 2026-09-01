[CmdletBinding()]
param(
    [string]$Owner = 'SHM2046',
    [string]$Repository = 'ae-expression-animation-manager-basic-updates',
    [string]$Version,
    [string]$Notes = '基础稳定版：GitHub 自动更新首发。'
)

$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json
if (-not $Version) { $Version = [string]$packageJson.version }

& (Join-Path $PSScriptRoot 'build-release-package.ps1') -Version $Version
if ($LASTEXITCODE -ne 0) { throw '打包失败。' }
$zip = Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'releases') -Filter "AEExpressionAnimationManager-Basic-v$Version.zip" -File | Select-Object -First 1
if (-not $zip) { throw '未找到发布 ZIP。' }
$checksum = (Get-FileHash -LiteralPath $zip.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$releaseTag = "v$Version"
$downloadUrl = "https://github.com/$Owner/$Repository/releases/download/$releaseTag/$($zip.Name)"

gh release view $releaseTag --repo "$Owner/$Repository" 2>$null
if ($LASTEXITCODE -eq 0) { gh release upload $releaseTag $zip.FullName --repo "$Owner/$Repository" --clobber }
else { gh release create $releaseTag $zip.FullName --repo "$Owner/$Repository" --title "基础版 v$Version" --notes $Notes }
if ($LASTEXITCODE -ne 0) { throw 'GitHub Release 发布失败。' }

$manifest = [ordered]@{
    version = $Version
    notes = $Notes
    publishedAt = (Get-Date).ToUniversalTime().ToString('o')
    package = [ordered]@{
        fileName = $zip.Name
        url = $downloadUrl
        sha256 = $checksum
        size = $zip.Length
    }
}
$json = $manifest | ConvertTo-Json -Depth 5
$content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
$endpoint = "repos/$Owner/$Repository/contents/update-manifest.json"
$sha = gh api $endpoint --jq .sha 2>$null
$arguments = @('--method','PUT',$endpoint,'-f','message=Publish base update manifest','-f',"content=$content")
if ($LASTEXITCODE -eq 0 -and $sha) { $arguments += @('-f',"sha=$sha") }
gh api @arguments | Out-Null
if ($LASTEXITCODE -ne 0) { throw '更新公开更新清单失败。' }
Write-Host "公开更新已发布：$downloadUrl" -ForegroundColor Green
