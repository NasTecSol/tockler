# Tockler Clean Script
Write-Host "--- Tockler Cleanup Utility ---" -ForegroundColor Cyan

# 1. Stop any running Tockler or Electron processes to release file locks
Write-Host "Terminating active processes..." -ForegroundColor Yellow
$processes = "tockler", "electron"
foreach ($p in $processes) {
    if (Get-Process $p -ErrorAction SilentlyContinue) {
        Write-Host "Stopping $p..."
        Stop-Process -Name $p -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 2 # Give OS time to release locks

# 2. Remove Electron build folders
Write-Host "Cleaning build folders..." -ForegroundColor Yellow
$folders = @(
    "electron/dist-electron",
    "electron/dist",
    "client/dist"
)
foreach ($f in $folders) {
    if (Test-Path $f) {
        Write-Host "Removing $f..."
        Remove-Item -Recurse -Force $f
    }
}

# 3. Remove Windows AppData (Database & Logs)
$appDataPath = "$env:APPDATA\TocklerDev"
if (Test-Path $appDataPath) {
    Write-Host "Removing AppData at $appDataPath..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $appDataPath -ErrorAction SilentlyContinue
    if (Test-Path $appDataPath) {
        Write-Host "WARNING: Some files in $appDataPath could not be removed. They might still be in use." -ForegroundColor Red
    }
}

Write-Host "Cleanup complete! Please run 'pnpm dev' in both client and electron folders." -ForegroundColor Green
