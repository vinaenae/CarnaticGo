# Setup KritiSamhita clips for Match the tanpura quiz.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root "data\kriti-samhita"
$ZipName = "Carnatic_Dataset_Snippets.zip"
$DownloadsZip = Join-Path $env:USERPROFILE "Downloads\$ZipName"

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

if (-not (Test-Path (Join-Path $DataDir $ZipName))) {
  if (Test-Path $DownloadsZip) {
    Write-Host "Copying $DownloadsZip -> $DataDir"
    Copy-Item $DownloadsZip (Join-Path $DataDir $ZipName)
  } else {
    Write-Host "Place $ZipName in Downloads or in $DataDir"
    Write-Host "Download: https://data.mendeley.com/datasets/nkdm57hvw3/2"
    exit 1
  }
}

$Extracted = Join-Path $DataDir "Carnatic_Dataset_Snippets"
if (-not (Test-Path $Extracted) -or -not (Get-ChildItem $Extracted -Recurse -Filter "*.mp3" -ErrorAction SilentlyContinue)) {
  Write-Host "Extracting zip..."
  Expand-Archive -Path (Join-Path $DataDir $ZipName) -DestinationPath $DataDir -Force
}

$Python = Join-Path $Root "services\raga-classifier\.venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { $Python = "python" }

$env:PYTHONUTF8 = "1"
& $Python (Join-Path $Root "services\raga-classifier\scripts\export_kriti_guess_samples.py") `
  --dataset-dir $DataDir --per-tonic 20

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done. Reload /melakarta/tanpura-match-quiz"
