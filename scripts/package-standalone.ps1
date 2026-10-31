param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$standalone = Join-Path $root "standalone"
if (-not $Version) {
  $Version = (Get-Content (Join-Path $standalone "package.json") -Raw | ConvertFrom-Json).version
}
$name = "interestseed-standalone-v$Version"
$out = Join-Path $root "release"
$pkg = Join-Path $out $name
if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
New-Item -ItemType Directory -Path $pkg -Force | Out-Null

Copy-Item (Join-Path $standalone "dist\cli.js") (Join-Path $pkg "cli.js")
Copy-Item (Join-Path $standalone "web") (Join-Path $pkg "web") -Recurse
Copy-Item (Join-Path $standalone "skill") (Join-Path $pkg "skill") -Recurse
New-Item -ItemType Directory -Path (Join-Path $pkg "mcp") -Force | Out-Null
Copy-Item (Join-Path $root "mcp\server.mjs") (Join-Path $pkg "mcp\server.mjs")
Copy-Item (Join-Path $standalone "PACKAGED_README.md") (Join-Path $pkg "README.md")
Copy-Item (Join-Path $root "LICENSE") (Join-Path $pkg "LICENSE")

$zip = Join-Path $out "$name.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $pkg -DestinationPath $zip
$hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
Set-Content -Path (Join-Path $out "$name.sha256") -Value "$hash  $name.zip" -Encoding ASCII
Write-Output $zip
Write-Output $hash
