param(
  [string]$Vault = 'C:\Users\30735\Documents\Obsidian\InterestSeed-4C11-Disposable',
  [string]$Repo = 'C:\Users\30735\Desktop\interestseed'
)

$ErrorActionPreference = 'Stop'
$plugin = Join-Path $Vault '.obsidian\plugins\interestseed'
$releaseDir = Join-Path $Repo 'release'
$zip = Join-Path $releaseDir 'interestseed-0.1.0.zip'

Set-Location $Repo
npm run verify
if ($LASTEXITCODE -ne 0) { throw 'verify failed; deployment aborted' }

New-Item -ItemType Directory -Path $plugin -Force | Out-Null
Copy-Item (Join-Path $Repo 'dist\main.js') (Join-Path $plugin 'main.js') -Force
Copy-Item (Join-Path $Repo 'dist\styles.css') (Join-Path $plugin 'styles.css') -Force
Copy-Item (Join-Path $Repo 'manifest.json') (Join-Path $plugin 'manifest.json') -Force

$stage = Join-Path $env:TEMP 'interestseed-deploy-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item (Join-Path $Repo 'dist\main.js') $stage
Copy-Item (Join-Path $Repo 'dist\styles.css') $stage
Copy-Item (Join-Path $Repo 'manifest.json') $stage
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip

$checksums = Join-Path $releaseDir 'SHA256SUMS.txt'
Get-FileHash $zip, (Join-Path $plugin 'main.js'), (Join-Path $plugin 'styles.css') -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash.ToLower())  $($_.Path)" } |
  Set-Content -Path $checksums -Encoding UTF8

Write-Host 'Deployed to:' $plugin
Get-FileHash (Join-Path $plugin 'main.js'), (Join-Path $plugin 'styles.css'), $zip -Algorithm SHA256 |
  Select-Object Path, Hash |
  Format-Table -AutoSize
