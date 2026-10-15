# Builds the Chrome Web Store package for Local Clipper.
# Usage:  powershell -ExecutionPolicy Bypass -File .\package.ps1
$ErrorActionPreference = "Stop"

$src = $PSScriptRoot
$manifest = Get-Content (Join-Path $src "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version

$extensionFiles = @(
  "manifest.json",
  "background.js",
  "archive.js",
  "capture.js",
  "content.js",
  "content.css",
  "reader.html",
  "reader.js",
  "reader.css",
  "import.js",
  "license.js",
  "zip.js",
  "sidepanel.html",
  "sidepanel.js"
)

$missing = $extensionFiles | Where-Object { -not (Test-Path (Join-Path $src $_)) }
if ($missing) { throw "Missing required files: $($missing -join ', ')" }

$out = Join-Path $src "local-clipper-$version.zip"
if (Test-Path $out) { Remove-Item $out }

Compress-Archive -Path ($extensionFiles | ForEach-Object { Join-Path $src $_ }) -DestinationPath $out

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($out)
$names = @($archive.Entries | ForEach-Object { $_.FullName })
$archive.Dispose()

if ($names -notcontains "manifest.json") { throw "manifest.json is not at the zip root." }
$nested = @($names | Where-Object { $_ -match "[/\\]" })
if ($nested.Count -gt 0) { throw "Zip contains nested paths: $($nested -join ', ')" }

Write-Host "Created: $out ($((Get-Item $out).Length) bytes)"
Write-Host "Version: $version"
Write-Host "Entries:"
$names | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "To test locally:"
Write-Host "  1. Extract this zip to a new folder."
Write-Host "  2. chrome://extensions -> Developer mode -> Load unpacked -> select the extracted folder."
Write-Host "  3. Save a page and open it offline from the Pages tab."
