Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

$electronExe = Join-Path $PSScriptRoot '..\node_modules\electron\dist\electron.exe'
$appDir = Join-Path $PSScriptRoot '..'

if (-not (Test-Path $electronExe)) {
    throw "Electron runtime not found at $electronExe"
}

Push-Location $appDir
try {
    & $electronExe .
} finally {
    Pop-Location
}
